import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/server/db/prisma';
import { getSession } from '@/server/http/get-session';
import { handleApiError } from '@/server/errors/handler';
import { unauthorized } from '@/server/errors/http-error';
import { enforceRateLimit } from '@/server/rate-limit/upstash-route';
import { getFreshUserInsights, getUserInsights } from '@/server/services/user-insights.service';

export const dynamic = 'force-dynamic';

const careerPackageSchema = z.object({
  targetRole: z.string().min(1).max(160),
  roleDescription: z.string().max(2000),
  skillsNeeded: z.array(z.string()).max(24),
  salaryExpectation: z.string().max(160),
  certifications: z.array(z.string()).max(12),
  careerPath: z.array(z.string()).max(8),
  careerGoal: z.string().max(2000),
});

export type CareerPackage = z.infer<typeof careerPackageSchema>;

function fallbackPackage(profile: {
  currentRole?: string | null;
  targetRole?: string | null;
  experienceYears?: string | null;
  careerGoal?: string | null;
}): CareerPackage {
  const current = profile.currentRole?.trim() || 'Professional';
  const target = profile.targetRole?.trim() || `Senior ${current}`;
  return {
    targetRole: target,
    roleDescription: `Grow from ${current} into ${target} by deepening technical expertise and leadership impact.`,
    skillsNeeded: ['Communication', 'Problem Solving', 'Leadership', 'Domain Expertise'],
    salaryExpectation: 'Competitive for role and location',
    certifications: [],
    careerPath: [current, `Mid-level ${current}`, target, `Lead ${target}`],
    careerGoal: profile.careerGoal?.trim() || `Transition to ${target} within 2–3 years.`,
  };
}

export async function POST() {
  try {
    const session = await getSession();
    if (!session?.user?.id) throw unauthorized();
    await enforceRateLimit(`user:${session.user.id}:ai.career-suggest`, { limit: 8, window: '60 m' });

    const profile = await prisma.profile.findUnique({ where: { userId: session.user.id } });
    const insights = await getFreshUserInsights(session.user.id) ?? await getUserInsights(session.user.id);
    if (insights) {
      const targetRoles = Array.isArray(insights.targetRoles) ? insights.targetRoles.map(String) : [];
      const careerGoals = Array.isArray(insights.careerGoals) ? insights.careerGoals.map(String) : [];
      const skillsNeeded = Array.isArray(insights.skillsGap)
        ? (insights.skillsGap as Array<Record<string, unknown>>).map(x => String(x.skill ?? '')).filter(Boolean)
        : [];
      const certs = Array.isArray((insights.careerPath as Record<string, unknown> | undefined)?.certifications)
        ? ((insights.careerPath as Record<string, unknown>).certifications as Array<Record<string, unknown>>).map(x => String(x.title ?? '')).filter(Boolean)
        : [];
      const stages = Array.isArray((insights.careerPath as Record<string, unknown> | undefined)?.stages)
        ? ((insights.careerPath as Record<string, unknown>).stages as Array<Record<string, unknown>>).map(x => String(x.title ?? '')).filter(Boolean)
        : [];
      const data: CareerPackage = {
        targetRole: targetRoles[0] ?? profile?.targetRole ?? profile?.currentRole ?? 'Professional',
        roleDescription: String((insights.careerPath as Record<string, unknown> | undefined)?.subtitle ?? ''),
        skillsNeeded,
        salaryExpectation: String(
          profile?.salaryExpectation
          ?? (insights.salaryInsights as Record<string, unknown> | undefined)?.futureRoleSalary
          ?? 'Competitive for role and location',
        ),
        certifications: certs,
        careerPath: stages,
        careerGoal: careerGoals[0] ?? profile?.careerGoal ?? '',
      };
      return NextResponse.json({ ok: true, data: { ...data, cached: true } });
    }

    const fallback = fallbackPackage(profile ?? {});
    return NextResponse.json({ ok: true, data: { ...fallback, cached: true } });
  } catch (e) {
    return handleApiError(e);
  }
}
