import { NextResponse } from 'next/server';
import { prisma } from '@/server/db/prisma';
import { getSession } from '@/server/http/get-session';
import { handleApiError } from '@/server/errors/handler';
import { unauthorized } from '@/server/errors/http-error';
import { generateJsonText } from '@/server/ai/gemini';
import { logger } from '@/server/logger';

export const dynamic = 'force-dynamic';

const CACHE_TTL_DAYS = 7;
const PROMPT_KEY = 'target-roles-v1';
const PROMPT_VER = '1';

/** Static progression map fallback. */
function fallbackRoles(currentRole: string): string[] {
  const r = currentRole.toLowerCase();
  if (r.includes('junior') || r.startsWith('jr')) {
    const base = currentRole.replace(/^(jr\.?|junior)\s*/i, '').trim();
    return [`${base}`, `Senior ${base}`, `Lead ${base}`];
  }
  if (r.includes('senior') || r.includes('sr')) {
    const base = currentRole.replace(/^(sr\.?|senior)\s*/i, '').trim();
    return [`Lead ${base}`, `Staff ${base}`, `Principal ${base}`];
  }
  if (r.includes('engineer') || r.includes('developer')) {
    return [`Senior ${currentRole}`, `Lead ${currentRole}`, `Staff Engineer`];
  }
  if (r.includes('analyst')) {
    return [`Senior Analyst`, `Lead Analyst`, `Analytics Manager`];
  }
  if (r.includes('manager')) {
    return [`Senior Manager`, `Director`, `VP of ${currentRole.replace(/manager/i, '').trim() || 'Operations'}`];
  }
  return [
    `Senior ${currentRole}`,
    `Lead ${currentRole}`,
    `Principal ${currentRole}`,
  ];
}

export async function POST() {
  try {
    const session = await getSession();
    if (!session?.user?.id) throw unauthorized();

    const profile = await prisma.profile.findUnique({ where: { userId: session.user.id } });
    const currentRole = profile?.currentRole ?? '';

    const roleHash = Buffer.from(currentRole).toString('base64').slice(0, 32);
    const cacheKey = `target-roles:${session.user.id}:${roleHash}`;

    const existing = await prisma.cachedAiResponse.findUnique({ where: { cacheKey } });
    if (existing && existing.expiresAt > new Date()) {
      const roles = (existing.response as { roles?: string[] })?.roles ?? fallbackRoles(currentRole);
      await prisma.cachedAiResponse.update({ where: { cacheKey }, data: { hitCount: { increment: 1 } } });
      return NextResponse.json({ ok: true, data: { roles, cached: true } });
    }

    let roles: string[];
    try {
      const { text } = await generateJsonText({
        quality: 'fast',
        system: 'You are a career advisor. Respond with valid JSON only.',
        user: [
          `Current role: ${currentRole || 'Not specified'}`,
          `Experience: ${profile?.experienceYears || 'Not specified'}`,
          '',
          'Suggest exactly 3 realistic next-level target roles for this professional.',
          'Roles should be one clear step above their current level in seniority or scope.',
          'Return JSON: { "roles": ["...", "...", "..."] }',
        ].join('\n'),
        maxOutputTokens: 150,
      });

      const parsed = JSON.parse(text) as { roles?: string[] };
      roles = Array.isArray(parsed.roles) && parsed.roles.length >= 3
        ? parsed.roles.slice(0, 3)
        : fallbackRoles(currentRole);
    } catch (err) {
      logger.warn('target-roles suggest: Gemini failed, using fallback', { err: String(err) });
      roles = fallbackRoles(currentRole);
    }

    const expiresAt = new Date(Date.now() + CACHE_TTL_DAYS * 86400_000);
    try {
      await prisma.cachedAiResponse.upsert({
        where: { cacheKey },
        create: {
          cacheKey,
          promptKey: PROMPT_KEY,
          promptVer: PROMPT_VER,
          model: 'gemini',
          response: { roles },
          expiresAt,
          userId: session.user.id,
        },
        update: {
          response: { roles },
          expiresAt,
          hitCount: 0,
          updatedAt: new Date(),
        },
      });
    } catch (cacheErr) {
      logger.warn('target-roles cache write failed', { err: String(cacheErr) });
    }

    return NextResponse.json({ ok: true, data: { roles, cached: false } });
  } catch (e) {
    return handleApiError(e);
  }
}
