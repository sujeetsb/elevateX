import { NextResponse } from 'next/server';
import { prisma } from '@/server/db/prisma';
import { getSession } from '@/server/http/get-session';
import { handleApiError } from '@/server/errors/handler';
import { unauthorized } from '@/server/errors/http-error';
import { enforceRateLimit } from '@/server/rate-limit/upstash-route';
import { isProTier, getUserSubscriptionTier } from '@/server/subscription/require-pro';
import { resolveSalaryLocale, type SalaryLocale } from '@/lib/salary/locale';
import {
  generateUserInsights,
  getFreshUserInsights,
  hasSalaryInsightsPayload,
} from '@/server/services/user-insights.service';
import { spendGamificationXp } from '@/server/gamification/gamification.service';
import { getXpCost } from '@/lib/gamification/xp-costs';

export const dynamic = 'force-dynamic';

function shapeSalaryPayload(raw: Record<string, unknown>, isPro: boolean, locale: SalaryLocale): Record<string, unknown> {
  const out: Record<string, unknown> = {
    ...raw,
    preferredCurrency: locale.currency,
    currency: locale.currency,
    salaryType: locale.salaryType,
    country: locale.country,
    showMonthlyAndYearly: locale.showMonthlyAndYearly,
  };
  if (!isPro) {
    delete out.growthTrend;
    delete out.roleComparison;
    out.premium = false;
  } else {
    out.premium = true;
  }
  return out;
}

function fallbackSalaryPayload(
  profile: {
    currentRole?: string | null;
    targetRole?: string | null;
    experienceYears?: string | null;
    locationPreference?: string | null;
    country?: string | null;
    preferredIndustry?: string | null;
    preferredIndustries?: string[];
    currentSalary?: string | null;
  } | null,
  skillLabels: string[],
  locale: SalaryLocale,
): Record<string, unknown> {
  const currentRole = profile?.currentRole ?? 'Professional';
  const targetRole = profile?.targetRole ?? `Senior ${currentRole}`;
  const location = profile?.locationPreference ?? profile?.country ?? locale.country;
  const industry = profile?.preferredIndustry ?? profile?.preferredIndustries?.[0] ?? 'General';
  const parsedCurrent = Number(String(profile?.currentSalary ?? '').replace(/[^0-9.]/g, ''));
  const hasCurrent = Number.isFinite(parsedCurrent) && parsedCurrent > 0;
  const currentValue = hasCurrent ? parsedCurrent : locale.currency === 'INR' ? 1_200_000 : 95_000;
  const baseAnnual = locale.salaryType === 'Monthly' ? currentValue * 12 : currentValue;
  const targetAnnual = Math.round(baseAnnual * 1.35);
  const currentFmt =
    locale.salaryType === 'Monthly'
      ? `${locale.symbol}${Math.round(currentValue).toLocaleString()}/month`
      : `${locale.symbol}${Math.round(baseAnnual).toLocaleString()}/year`;

  return {
    currentEstimate: currentFmt,
    currentEstimateMonthly: locale.showMonthlyAndYearly ? `${locale.symbol}${Math.round(baseAnnual / 12).toLocaleString()}/month` : undefined,
    roleAverage: locale.currency === 'INR' ? '₹12L/year' : '$95k/year',
    futureRoleSalary:
      locale.currency === 'INR'
        ? `₹${(targetAnnual / 100000).toFixed(1)}L/year`
        : `${locale.symbol}${Math.round(targetAnnual).toLocaleString()}/year`,
    fiveYearProjection: 'Steady growth with senior transition in years 2–3',
    industryBenchmark: `At or above median for ${industry} roles in ${location}`,
    locationComparison: `${location}: competitive market vs national average`,
    growthTrend: [
      { year: 1, salary: baseAnnual },
      { year: 3, salary: Math.round(baseAnnual * 1.25) },
      { year: 5, salary: Math.round(baseAnnual * 1.5) },
    ],
    roleComparison: [
      { role: currentRole, salary: baseAnnual },
      { role: targetRole, salary: targetAnnual },
    ],
    recommendations: [
      `Benchmark your ${currentRole} offer against ${location} market data.`,
      `Highlight ${skillLabels.slice(0, 3).join(', ') || 'in-demand skills'} to justify top-of-band pay.`,
      `Target ${targetRole} transition to unlock ${locale.currency === 'INR' ? '₹4–6L' : '$25–40k'} upside.`,
    ],
  };
}

export async function GET() {
  try {
    const session = await getSession();
    if (!session?.user?.id) throw unauthorized();

    const [profile, skills, tier] = await Promise.all([
      prisma.profile.findUnique({ where: { userId: session.user.id } }),
      prisma.userSkill.findMany({
        where: { userId: session.user.id },
        include: { skill: { select: { label: true } } },
        take: 12,
      }),
      getUserSubscriptionTier(session.user.id),
    ]);

    const isPro = isProTier(tier);
    const locale = resolveSalaryLocale(profile ?? {});
    const skillLabels = skills.map(s => s.skill.label).filter(Boolean);

    let stored = await getFreshUserInsights(session.user.id);
    const needsRegen = !stored?.salaryInsights || !hasSalaryInsightsPayload(stored.salaryInsights);
    if (needsRegen) {
      // Only rate-limit expensive AI regeneration — cached DB reads are cheap.
      await enforceRateLimit(`user:${session.user.id}:salary-insights:generate`, { limit: 6, window: '60 m' });
      const xpCost = getXpCost('SALARY_INSIGHTS');
      await spendGamificationXp({
        userId: session.user.id,
        amount: xpCost,
        actionKey: `salary-insights:${session.user.id}:${new Date().toISOString().slice(0, 10)}`,
        actionType: 'SALARY_INSIGHTS',
      });
      stored = await generateUserInsights(session.user.id);
    }

    const raw =
      stored?.salaryInsights && hasSalaryInsightsPayload(stored.salaryInsights)
        ? (stored.salaryInsights as Record<string, unknown>)
        : fallbackSalaryPayload(profile, skillLabels, locale);

    const payload = shapeSalaryPayload(raw, isPro, locale);
    const cached = hasSalaryInsightsPayload(stored?.salaryInsights);

    return NextResponse.json({
      ok: true,
      data: {
        ...payload,
        cached,
        source: cached ? 'user_insights' : 'fallback',
        profileVersion: profile?.profileVersion ?? 0,
      },
    });
  } catch (e) {
    return handleApiError(e);
  }
}
