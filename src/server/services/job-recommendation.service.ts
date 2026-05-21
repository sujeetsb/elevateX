import type { Job } from '@prisma/client';
import { prisma } from '@/server/db/prisma';

export type RankedJob = { job: Job; score: number; reasons: string[] };

function scoreJob(job: Job, skillSlugs: Set<string>, targetRole: string): RankedJob {
  const hay = `${job.title} ${job.description ?? ''} ${job.company}`.toLowerCase();
  const reasons: string[] = [];
  let s = 35;
  for (const slug of skillSlugs) {
    if (hay.includes(slug.toLowerCase())) {
      s += 5;
      reasons.push(`skill:${slug}`);
    }
  }
  const tr = targetRole.toLowerCase();
  if (tr && hay.includes(tr)) {
    s += 12;
    reasons.push('target-role');
  }
  if (hay.includes('remote')) {
    s += 3;
    reasons.push('remote');
  }
  return { job, score: Math.min(100, Math.round(s)), reasons };
}

export async function getRankedJobsForUser(userId: string): Promise<RankedJob[]> {
  const [profile, skills, prefs] = await Promise.all([
    prisma.profile.findUnique({ where: { userId } }),
    prisma.userSkill.findMany({ where: { userId }, include: { skill: true } }),
    prisma.jobPreference.findUnique({ where: { userId } }),
  ]);

  const slugs = new Set(skills.map(s => s.skill.slug));
  const target = profile?.targetRole ?? 'software engineer';

  const jobs = await prisma.job.findMany({
    where: { deletedAt: null },
    take: 100,
    orderBy: { updatedAt: 'desc' },
  });

  let ranked = jobs.map(j => scoreJob(j, slugs, target.toLowerCase()));

  if (prefs?.keywords?.length) {
    ranked = ranked.map(r => {
      let bonus = 0;
      const h = `${r.job.title} ${r.job.description ?? ''}`.toLowerCase();
      for (const kw of prefs.keywords) {
        if (h.includes(kw.toLowerCase())) bonus += 4;
      }
      return { ...r, score: Math.min(100, r.score + bonus) };
    });
  }

  ranked.sort((a, b) => b.score - a.score);
  return ranked.slice(0, 30);
}
