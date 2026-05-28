import type { Job } from '@prisma/client';
import { prisma } from '@/server/db/prisma';
import { getUserInsights } from '@/server/services/user-insights.service';

export type RankedJob = { job: Job; score: number; reasons: string[] };

const TECH_PATTERN =
  /\b(software|engineer|developer|frontend|backend|fullstack|full-stack|devops|sre|programmer|coding|typescript|javascript|react|node\.?js|python|java|kubernetes|aws|cloud infrastructure|data engineer|ml engineer)\b/i;

function roleIsTech(role: string): boolean {
  return TECH_PATTERN.test(role);
}

function jobIsTech(job: Job): boolean {
  const hay = `${job.title} ${job.description ?? ''}`;
  return TECH_PATTERN.test(hay);
}

function parseSalaryToAnnual(value?: string | null, currency?: string | null): number | null {
  if (!value) return null;
  const raw = value.trim().toLowerCase();
  if (!raw) return null;
  const num = Number(raw.replace(/[^0-9.]/g, ''));
  if (!Number.isFinite(num) || num <= 0) return null;

  // Handle common "Lakh" notation used in INR profiles.
  const lakhAdjusted = /\bl\b|\blakh\b/.test(raw) ? num * 100_000 : num;
  const monthly = /\bmonth|monthly\b/.test(raw);
  const annualBase = monthly ? lakhAdjusted * 12 : lakhAdjusted;

  // For USD, values below 1000 are likely "k" shorthand.
  if ((currency ?? '').toUpperCase() === 'USD' && annualBase < 1_000) {
    return annualBase * 1_000;
  }
  return annualBase;
}

function scoreJob(
  job: Job,
  skillSlugs: Set<string>,
  skillLabels: Set<string>,
  targetRole: string,
  currentRole: string,
  experienceYears: string,
  locationPref: string,
  education: string,
  industry: string,
  careerGoal: string,
  userIsTech: boolean,
  salaryFloorAnnual: number | null,
  salaryTargetAnnual: number | null,
): RankedJob {
  const hay = `${job.title} ${job.description ?? ''} ${job.company} ${job.location ?? ''}`.toLowerCase();
  const reasons: string[] = [];
  let s = 22;

  if (!userIsTech && jobIsTech(job)) {
    // Prefer non-tech roles for non-tech users, but never hard-exclude the catalog.
    s -= 10;
    reasons.push('industry-mismatch');
  }

  for (const slug of skillSlugs) {
    if (hay.includes(slug.toLowerCase())) {
      s += 6;
      reasons.push(`skill:${slug}`);
    }
  }
  for (const label of skillLabels) {
    if (label.length > 2 && hay.includes(label.toLowerCase())) {
      s += 4;
      reasons.push(`skill:${label}`);
    }
  }

  const tr = targetRole.toLowerCase();
  const cr = currentRole.toLowerCase();
  if (tr && hay.includes(tr)) {
    s += 18;
    reasons.push('target-role');
  } else if (tr) {
    const tokens = tr.split(/\s+/).filter(t => t.length > 3);
    const hits = tokens.filter(t => hay.includes(t)).length;
    if (hits > 0) {
      s += hits * 5;
      reasons.push('role-partial');
    }
  }

  if (cr && hay.includes(cr)) {
    s += 8;
    reasons.push('current-role');
  }

  const ind = industry.toLowerCase();
  if (ind && ind !== 'technology' && ind !== 'tech') {
    if (hay.includes(ind)) {
      s += 14;
      reasons.push('industry');
    }
  }

  const goalTokens = careerGoal.toLowerCase().split(/\s+/).filter(t => t.length > 4);
  for (const t of goalTokens.slice(0, 6)) {
    if (hay.includes(t)) {
      s += 2;
      reasons.push('career-goal');
      break;
    }
  }

  const expMatch = experienceYears.match(/\d+/);
  if (expMatch) {
    const yrs = Number(expMatch[0]);
    if (yrs >= 5 && /\bsenior\b|\blead\b|\bstaff\b|\bmanager\b/i.test(job.title)) s += 8;
    if (yrs < 3 && /\bjunior\b|\bentry\b|\bassociate\b|\btrainee\b/i.test(job.title)) s += 8;
  }

  const loc = locationPref.toLowerCase();
  if (loc && job.location && job.location.toLowerCase().includes(loc.split(',')[0] ?? loc)) {
    s += 10;
    reasons.push('location');
  }

  if (education) {
    const eduToken = education.toLowerCase().split(/\s+/).find(t => t.length > 4);
    if (eduToken && hay.includes(eduToken)) {
      s += 4;
      reasons.push('education');
    }
  }

  if (hay.includes('remote')) {
    s += 4;
    reasons.push('remote');
  }

  const jobMin = typeof job.salaryMin === 'number' ? job.salaryMin : null;
  const jobMax = typeof job.salaryMax === 'number' ? job.salaryMax : null;
  const target = salaryTargetAnnual ?? salaryFloorAnnual;
  if (target != null && (jobMin != null || jobMax != null)) {
    const midpoint =
      jobMin != null && jobMax != null ? Math.round((jobMin + jobMax) / 2) : (jobMax ?? jobMin ?? target);
    if (midpoint >= target) {
      s += 10;
      reasons.push('salary-fit');
    } else if (midpoint >= target * 0.8) {
      s += 4;
      reasons.push('salary-close');
    } else {
      s -= 6;
      reasons.push('salary-low');
    }
  }

  return { job, score: Math.min(100, Math.round(s)), reasons };
}

export async function getRankedJobsForUser(userId: string): Promise<RankedJob[]> {
  const [profile, skills, prefs, insights] = await Promise.all([
    prisma.profile.findUnique({ where: { userId } }),
    prisma.userSkill.findMany({ where: { userId }, include: { skill: true } }),
    prisma.jobPreference.findUnique({ where: { userId } }),
    getUserInsights(userId),
  ]);

  const insightRoles = Array.isArray(insights?.targetRoles)
    ? (insights!.targetRoles as string[])
    : [];
  const insightIndustry = insights?.industry ?? profile?.preferredIndustry ?? '';

  const slugs = new Set(skills.map(s => s.skill.slug));
  const labels = new Set(skills.map(s => s.skill.label));
  const currentRole = profile?.currentRole ?? '';
  const target = profile?.targetRole ?? insightRoles[0] ?? currentRole ?? '';
  const experience = profile?.experienceYears ?? '';
  const location = profile?.locationPreference ?? profile?.country ?? '';
  const education = profile?.education ?? '';
  const careerGoal = profile?.careerGoal ?? '';
  const industry = insightIndustry || profile?.preferredIndustry || '';
  const userIsTech = roleIsTech(currentRole) || roleIsTech(target) || roleIsTech(industry);
  const salaryFloorAnnual = parseSalaryToAnnual(profile?.currentSalary, profile?.salaryCurrency);
  const salaryTargetAnnual = parseSalaryToAnnual(
    profile?.salaryExpectation,
    profile?.salaryGoalCurrency ?? profile?.salaryCurrency,
  );

  const jobs = await prisma.job.findMany({
    where: { deletedAt: null },
    take: 200,
    orderBy: { updatedAt: 'desc' },
  });

  let ranked = jobs
    .map(j =>
      scoreJob(
        j,
        slugs,
        labels,
        target.toLowerCase(),
        currentRole.toLowerCase(),
        experience,
        location,
        education,
        industry,
        careerGoal,
        userIsTech,
        salaryFloorAnnual,
        salaryTargetAnnual,
      ),
    )
    .filter(r => r.score > 0);

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

  const strong = ranked.filter(r => r.score >= 38);
  if (strong.length >= 5) return strong.slice(0, 30);

  const broad = ranked.filter(r => r.score >= 18);
  if (broad.length >= 5) return broad.slice(0, 30);

  // Always return best available matches when catalog is small/sparse.
  return ranked.slice(0, 30);
}
