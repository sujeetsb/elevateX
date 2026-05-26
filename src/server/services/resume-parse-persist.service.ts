import { Prisma, RecommendationKind, ActivityVerb } from '@prisma/client';
import { prisma, prismaInteractiveTx } from '@/server/db/prisma';
import { batchLinkUserSkills, withTransactionRetry } from '@/server/db/batch-user-skills';
import { cacheService } from '@/server/cache/cache-service';
import { promptKeys, PROMPT_VERSION } from '@/server/ai/prompts/registry';
import type { ResumeIntelligence } from '@/server/ai/schemas';
import { logger } from '@/server/logger';
import { recomputeGamificationBadgesForUser } from '@/server/gamification/gamification.service';

function normalizeOptionalHttpUrl(val: string | null | undefined): string | undefined {
  if (!val?.trim()) return undefined;
  const t = val.trim();
  if (/^https?:\/\//i.test(t)) return t.slice(0, 512);
  return `https://${t.replace(/^\/+/, '')}`.slice(0, 512);
}

function educationText(ed: ResumeIntelligence['education']): string | undefined {
  if (!ed?.length) return undefined;
  return ed
    .map(e =>
      [e.institution ?? e.school, e.degree, e.specialization, e.years, e.grade].filter(Boolean).join(' — '),
    )
    .join('\n')
    .slice(0, 4000);
}

/**
 * Persist parsed resume intelligence: resume row + profile + side-effects.
 * Heavy skill upserts run outside the interactive transaction to avoid start timeouts.
 */
export async function persistResumeIntelligence(resumeId: string, data: ResumeIntelligence): Promise<void> {
  const resume = await prisma.resume.findFirst({ where: { id: resumeId, deletedAt: null } });
  if (!resume) {
    logger.warn('persistResumeIntelligence: resume not found', { resumeId });
    throw new Error(`Resume not found: ${resumeId}`);
  }
  const userId = resume.userId;

  await withTransactionRetry('persistResumeIntelligence.core', () =>
    prisma.$transaction(
      async tx => {
        await tx.resume.update({
          where: { id: resumeId },
          data: {
            parsedJson: data as Prisma.InputJsonValue,
            atsScore: data.atsScore,
            confidence: (data.confidence ?? {}) as Prisma.InputJsonValue,
            parseStatus: 'COMPLETE',
            parseError: null,
            lastParsedAt: new Date(),
            parseVersion: resume.parseVersion + 1,
          },
        });

        const headline =
          data.headline?.trim() ||
          data.targetRolesSuggested?.[0] ||
          (data.personal?.fullName ? `${String(data.personal.fullName).split(' ')[0]} — professional` : undefined);
        const firstExp = data.experience?.[0];
        const currentRoleFromExperience =
          firstExp?.title?.trim() || firstExp?.role?.trim() || undefined;
        const existingProfile = await tx.profile.findUnique({
          where: { userId },
          select: {
            id: true,
            onboardingComplete: true,
            headline: true,
            bio: true,
            currentRole: true,
            experienceYears: true,
            education: true,
            targetRole: true,
            linkedInUrl: true,
            githubUrl: true,
            portfolioUrl: true,
          },
        });
        const preserveUserEdits = Boolean(existingProfile?.onboardingComplete);

        await tx.profile.upsert({
          where: { userId },
          create: {
            userId,
            headline,
            bio: data.summary ?? undefined,
            currentRole: currentRoleFromExperience,
            experienceYears:
              data.yearsOfExperienceApprox != null ? String(data.yearsOfExperienceApprox) : undefined,
            education: educationText(data.education),
            targetRole: data.targetRolesSuggested?.[0] ?? undefined,
            linkedInUrl: normalizeOptionalHttpUrl(data.personal?.linkedIn),
            githubUrl: normalizeOptionalHttpUrl(data.personal?.github),
            portfolioUrl: normalizeOptionalHttpUrl(data.personal?.portfolio ?? data.personal?.website),
            onboardingComplete: false,
          },
          update: {
            headline: preserveUserEdits && existingProfile?.headline ? existingProfile.headline : headline,
            bio: preserveUserEdits && existingProfile?.bio ? existingProfile.bio : (data.summary ?? undefined),
            currentRole: preserveUserEdits && existingProfile?.currentRole ? existingProfile.currentRole : currentRoleFromExperience,
            experienceYears:
              preserveUserEdits && existingProfile?.experienceYears
                ? existingProfile.experienceYears
                : (data.yearsOfExperienceApprox != null ? String(data.yearsOfExperienceApprox) : undefined),
            education: preserveUserEdits && existingProfile?.education ? existingProfile.education : educationText(data.education),
            targetRole: preserveUserEdits && existingProfile?.targetRole ? existingProfile.targetRole : (data.targetRolesSuggested?.[0] ?? undefined),
            linkedInUrl: preserveUserEdits && existingProfile?.linkedInUrl ? existingProfile.linkedInUrl : normalizeOptionalHttpUrl(data.personal?.linkedIn),
            githubUrl: preserveUserEdits && existingProfile?.githubUrl ? existingProfile.githubUrl : normalizeOptionalHttpUrl(data.personal?.github),
            portfolioUrl: preserveUserEdits && existingProfile?.portfolioUrl ? existingProfile.portfolioUrl : normalizeOptionalHttpUrl(data.personal?.portfolio ?? data.personal?.website),
          },
        });

        if (data.personal?.fullName?.trim()) {
          await tx.user.update({
            where: { id: userId },
            data: { name: data.personal.fullName.trim() },
          });
        }

        await tx.aiRecommendation.deleteMany({
          where: { userId, promptKey: { startsWith: 'resume.pipeline' } },
        });

        for (const gap of data.gaps.slice(0, 10)) {
          await tx.aiRecommendation.create({
            data: {
              userId,
              kind: RecommendationKind.LEARNING,
              score: 72,
              payload: { gap, type: 'skill_gap' } as Prisma.InputJsonValue,
              rationale: `Close gap: ${gap}`,
              promptKey: 'resume.pipeline.learning',
              promptVer: PROMPT_VERSION,
            },
          });
        }

        if (data.atsScore < 82) {
          await tx.aiRecommendation.create({
            data: {
              userId,
              kind: RecommendationKind.RESUME_ACTION,
              score: 88,
              payload: { actions: data.gaps.slice(0, 5), atsScore: data.atsScore } as Prisma.InputJsonValue,
              rationale: 'ATS improvement checklist from latest parse.',
              promptKey: 'resume.pipeline.ats',
              promptVer: PROMPT_VERSION,
            },
          });
        }

        await tx.activityLog.create({
          data: {
            userId,
            verb: ActivityVerb.RESUME_PARSE,
            subject: resumeId,
            metadata: { atsScore: data.atsScore, skills: data.skills.length } as Prisma.InputJsonValue,
          },
        });

        await tx.userAnalytics.upsert({
          where: { userId },
          create: { userId, lastActiveAt: new Date() },
          update: { lastActiveAt: new Date() },
        });

        await tx.cachedAiResponse.upsert({
          where: { cacheKey: `resume:${resumeId}:intelligence` },
          create: {
            cacheKey: `resume:${resumeId}:intelligence`,
            promptKey: promptKeys.resumeIntelligence,
            promptVer: PROMPT_VERSION,
            model: 'gemini',
            response: data as Prisma.InputJsonValue,
            expiresAt: new Date(Date.now() + 14 * 864e5),
            userId,
          },
          update: {
            response: data as Prisma.InputJsonValue,
            promptVer: PROMPT_VERSION,
            expiresAt: new Date(Date.now() + 14 * 864e5),
          },
        });
      },
      prismaInteractiveTx.heavy,
    ),
  );

  await batchLinkUserSkills(userId, data.skills, 'resume_ai', 48);

  const { bumpProfileVersion } = await import('@/server/services/profile-version.service');
  await bumpProfileVersion(userId);

  await cacheService.invalidateUser(userId);

  void recomputeGamificationBadgesForUser(userId);
}
