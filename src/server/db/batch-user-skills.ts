import { Prisma } from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { prisma, prismaInteractiveTx } from '@/server/db/prisma';
import { logger } from '@/server/logger';

function slugify(label: string): string {
  const s = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
  return s || 'skill';
}

/**
 * Replaces per-row skill upserts inside long transactions.
 * Uses createMany + skipDuplicates to reduce round-trips and lock time.
 */
export async function batchLinkUserSkills(
  userId: string,
  labels: string[],
  source: 'profile' | 'resume_ai',
  maxSkills = 48,
): Promise<void> {
  const trimmed = [...new Set(labels.map(l => l.trim()).filter(Boolean))].slice(0, maxSkills);
  if (!trimmed.length) {
    await prisma.userSkill.deleteMany({ where: { userId, source } });
    return;
  }

  await prisma.$transaction(
    async tx => {
      await tx.userSkill.deleteMany({ where: { userId, source } });

      const slugToLabel = new Map<string, string>();
      for (const label of trimmed) {
        const slug = slugify(label);
        if (!slugToLabel.has(slug)) slugToLabel.set(slug, label.slice(0, 120));
      }
      const slugs = [...slugToLabel.keys()];

      const existing = await tx.skill.findMany({
        where: { slug: { in: slugs } },
        select: { id: true, slug: true },
      });
      const have = new Set(existing.map(s => s.slug));
      const missing = slugs.filter(s => !have.has(s));
      if (missing.length) {
        await tx.skill.createMany({
          data: missing.map(slug => ({
            slug,
            label: slugToLabel.get(slug) ?? slug,
            category: source === 'profile' ? 'profile' : 'resume',
          })),
          skipDuplicates: true,
        });
      }

      const skills = await tx.skill.findMany({
        where: { slug: { in: slugs } },
        select: { id: true, slug: true },
      });
      const bySlug = new Map(skills.map(s => [s.slug, s.id]));

      const rows: Prisma.UserSkillCreateManyInput[] = [];
      for (const slug of slugs) {
        const skillId = bySlug.get(slug);
        if (!skillId) continue;
        rows.push({
          userId,
          skillId,
          source,
          proficiency: 'INTERMEDIATE',
        });
      }
      if (rows.length) {
        await tx.userSkill.createMany({
          data: rows,
          skipDuplicates: true,
        });
      }
    },
    { ...prismaInteractiveTx.standard, timeout: 45_000, maxWait: 15_000 },
  );
}

export function isPrismaTransactionStartTimeout(e: unknown): boolean {
  if (e instanceof PrismaClientKnownRequestError) {
    if (e.code === 'P2034' || e.code === 'P2028') return true;
    if (e.message?.includes('Unable to start a transaction')) return true;
  }
  return false;
}

export async function withTransactionRetry<T>(
  label: string,
  fn: () => Promise<T>,
  maxAttempts = 3,
): Promise<T> {
  let last: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      if (isPrismaTransactionStartTimeout(e) && attempt < maxAttempts) {
        const delay = 400 * attempt;
        logger.warn(`${label}: transaction start timeout, retrying`, { attempt, delay });
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      throw e;
    }
  }
  throw last;
}
