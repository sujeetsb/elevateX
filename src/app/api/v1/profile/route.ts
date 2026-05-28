import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/server/db/prisma';
import { getSession } from '@/server/http/get-session';
import { invalidateUserProfileCache } from '@/server/cache/invalidate-user-profile';
import {
  bumpProfileVersion,
  profilePatchInvalidatesInsights,
} from '@/server/services/profile-version.service';
import { handleApiError } from '@/server/errors/handler';
import { unauthorized } from '@/server/errors/http-error';
import { batchLinkUserSkills, withTransactionRetry } from '@/server/db/batch-user-skills';
import { prismaInteractiveTx } from '@/server/db/prisma';
import { logger } from '@/server/logger';
import { ActivityVerb } from '@prisma/client';
import { awardGamificationXp } from '@/server/gamification/gamification.service';

export const dynamic = 'force-dynamic';

const optionalHttpString = z
  .string()
  .max(512)
  .optional()
  .transform(s => {
    if (s == null) return undefined;
    const t = s.trim();
    if (!t) return undefined;
    if (/^https?:\/\//i.test(t)) return t.slice(0, 512);
    return `https://${t.replace(/^\/+/, '')}`.slice(0, 512);
  });

const profileSchema = z.object({
  name: z.string().max(120).optional(),
  headline: z.string().max(160).optional(),
  bio: z.string().max(4000).optional(),
  currentRole: z.string().max(160).optional(),
  experienceYears: z.string().max(64).optional(),
  education: z.string().max(4000).optional(),
  careerGoal: z.string().max(2000).optional(),
  targetRole: z.string().max(160).optional(),
  preferredIndustry: z.string().max(160).optional(),
  preferredIndustries: z.array(z.string().min(1).max(160)).max(3).optional(),
  themePreference: z.enum(['dark', 'light', 'system']).optional(),
  salaryExpectation: z.string().max(160).optional(),
  salaryGoalCurrency: z.enum(['INR', 'USD', 'EUR', 'GBP']).optional(),
  salaryGoalFrequency: z.enum(['Monthly', 'Annual']).optional(),
  currentSalary: z.string().max(64).optional(),
  salaryCurrency: z.enum(['INR', 'USD', 'EUR', 'GBP']).optional(),
  salaryFrequency: z.enum(['Monthly', 'Annual']).optional(),
  compensationType: z.enum(['Fixed', 'CTC', 'Hourly', 'Contract']).optional(),
  country: z.string().max(80).optional(),
  locationPreference: z.string().max(160).optional(),
  linkedInUrl: optionalHttpString,
  githubUrl: optionalHttpString,
  portfolioUrl: optionalHttpString,
  skills: z.array(z.string().min(1).max(120)).max(80).optional(),
  onboardingComplete: z.boolean().optional(),
});

export async function PATCH(req: Request) {
  try {
    const session = await getSession();
    if (!session?.user?.id) throw unauthorized();

    const json = await req.json();
    const body = profileSchema.parse(json);

    const { name, skills, onboardingComplete, ...profileFields } = body;

    const profile = await withTransactionRetry('profile.patch', () =>
      prisma.$transaction(
        async tx => {
          const p = await tx.profile.upsert({
            where: { userId: session.user.id },
            create: {
              userId: session.user.id,
              ...profileFields,
              onboardingComplete: onboardingComplete ?? false,
            },
            update: {
              ...profileFields,
              ...(onboardingComplete !== undefined ? { onboardingComplete } : {}),
            },
          });

          if (name?.trim()) {
            await tx.user.update({
              where: { id: session.user.id },
              data: { name: name.trim() },
            });
          }

          return p;
        },
        { ...prismaInteractiveTx.standard, timeout: 60_000, maxWait: 25_000 },
      ),
    );

    if (skills?.length) {
      try {
        await batchLinkUserSkills(session.user.id, skills, 'profile', 80);
      } catch (e) {
        logger.error('profile.patch skills batch failed', { userId: session.user.id, error: String(e) });
        throw e;
      }
    }

    let finalProfile = profile;

    if (profilePatchInvalidatesInsights(profileFields, Boolean(skills?.length))) {
      await bumpProfileVersion(session.user.id);
      finalProfile =
        (await prisma.profile.findUnique({ where: { userId: session.user.id } })) ?? profile;
    }

    await invalidateUserProfileCache(session.user.id);

    const salaryTouched =
      profileFields.currentSalary !== undefined ||
      profileFields.salaryExpectation !== undefined ||
      profileFields.salaryCurrency !== undefined ||
      profileFields.salaryGoalCurrency !== undefined;
    if (salaryTouched && finalProfile) {
      const { appendSalaryHistoryPoint } = await import('@/server/services/analytics-history.service');
      await appendSalaryHistoryPoint(session.user.id, {
        current: finalProfile.currentSalary,
        goal: finalProfile.salaryExpectation,
        currency: finalProfile.salaryCurrency ?? 'USD',
        goalCurrency: finalProfile.salaryGoalCurrency ?? finalProfile.salaryCurrency ?? 'USD',
      });
    }

    const today = new Date().toISOString().slice(0, 10);
    await awardGamificationXp({
      userId: session.user.id,
      amount: 10,
      actionKey: `profile-update:${today}`,
      actionType: 'PROFILE_UPDATE',
    });
    await prisma.activityLog.create({
      data: { userId: session.user.id, verb: ActivityVerb.PROFILE_UPDATE, subject: 'profile' },
    });

    return NextResponse.json({ ok: true, data: finalProfile });
  } catch (e) {
    return handleApiError(e);
  }
}
