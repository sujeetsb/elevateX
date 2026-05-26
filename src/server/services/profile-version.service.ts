import { createHash } from 'node:crypto';
import type { Profile } from '@prisma/client';
import { prisma } from '@/server/db/prisma';

/** Fields that should invalidate salary / career intelligence when changed. */
export const INSIGHT_RELEVANT_PROFILE_FIELDS = [
  'currentRole',
  'targetRole',
  'experienceYears',
  'careerGoal',
  'education',
  'preferredIndustry',
  'country',
  'locationPreference',
  'currentSalary',
  'salaryExpectation',
  'salaryCurrency',
  'salaryFrequency',
  'compensationType',
] as const;

export function computeProfileSourceHash(parts: {
  resumeId?: string | null;
  resumeContentHash?: string | null;
  currentRole?: string | null;
  targetRole?: string | null;
  experienceYears?: string | null;
  careerGoal?: string | null;
  education?: string | null;
  industry?: string | null;
  country?: string | null;
  locationPreference?: string | null;
  currentSalary?: string | null;
  salaryExpectation?: string | null;
  salaryCurrency?: string | null;
  salaryFrequency?: string | null;
  compensationType?: string | null;
  skills?: string[];
}): string {
  return createHash('sha256')
    .update(
      [
        parts.resumeId ?? '',
        parts.resumeContentHash ?? '',
        parts.currentRole ?? '',
        parts.targetRole ?? '',
        parts.experienceYears ?? '',
        parts.careerGoal ?? '',
        parts.education ?? '',
        parts.industry ?? '',
        parts.country ?? '',
        parts.locationPreference ?? '',
        parts.currentSalary ?? '',
        parts.salaryExpectation ?? '',
        parts.salaryCurrency ?? '',
        parts.salaryFrequency ?? '',
        parts.compensationType ?? '',
        (parts.skills ?? []).join(','),
      ].join('|'),
      'utf8',
    )
    .digest('hex')
    .slice(0, 32);
}

export function profilePatchInvalidatesInsights(
  fields: Partial<Record<(typeof INSIGHT_RELEVANT_PROFILE_FIELDS)[number], unknown>>,
  skillsChanged?: boolean,
): boolean {
  if (skillsChanged) return true;
  return INSIGHT_RELEVANT_PROFILE_FIELDS.some(key => fields[key] !== undefined);
}

/** Bump profileVersion so cached UserInsights are treated as stale. */
export async function bumpProfileVersion(userId: string): Promise<number> {
  const profile = await prisma.profile.upsert({
    where: { userId },
    create: { userId, profileVersion: 1 },
    update: { profileVersion: { increment: 1 } },
    select: { profileVersion: true },
  });
  return profile.profileVersion;
}

export function isInsightsFresh(
  insights: { profileVersion?: number | null; sourceHash?: string | null } | null,
  profile: Pick<Profile, 'profileVersion'> | null,
  sourceHash: string,
): boolean {
  if (!insights) return false;
  if (insights.profileVersion != null && profile?.profileVersion != null) {
    return insights.profileVersion === profile.profileVersion;
  }
  return Boolean(insights.sourceHash && insights.sourceHash === sourceHash);
}

export function hasSalaryInsightsPayload(salaryInsights: unknown): boolean {
  return (
    salaryInsights != null &&
    typeof salaryInsights === 'object' &&
    Object.keys(salaryInsights as object).length > 0
  );
}
