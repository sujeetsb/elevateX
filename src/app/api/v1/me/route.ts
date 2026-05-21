import { NextResponse } from 'next/server';
import { prisma } from '@/server/db/prisma';
import { getSession } from '@/server/http/get-session';
import { cacheService } from '@/server/cache/cache-service';
import { cacheKeys } from '@/server/cache/cache-keys';
import { handleApiError } from '@/server/errors/handler';
import { unauthorized } from '@/server/errors/http-error';
import { getGamificationFromSnapshot } from '@/server/gamification/gamification.service';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getSession();
    if (!session?.user?.id) throw unauthorized();

    const key = cacheKeys.userProfile(session.user.id);
    const cached = await cacheService.getJson<unknown>(key);
    if (cached) {
      return NextResponse.json({ ok: true, source: 'cache', data: cached });
    }

    const [user, profile, skills, analytics, latestResume, certifications] = await Promise.all([
      prisma.user.findUnique({
        where: { id: session.user.id },
        select: { id: true, name: true, email: true, image: true, role: true, createdAt: true },
      }),
      prisma.profile.findUnique({ where: { userId: session.user.id } }),
      prisma.userSkill.findMany({
        where: { userId: session.user.id },
        include: { skill: true },
      }),
      prisma.userAnalytics.findUnique({
        where: { userId: session.user.id },
        select: { snapshot: true, lastActiveAt: true, jobViews: true, jobClicks: true, learningMinutes: true, aiTokensMonth: true },
      }),
      prisma.resume.findFirst({
        where: { userId: session.user.id, deletedAt: null },
        orderBy: { updatedAt: 'desc' },
        select: { id: true, parseStatus: true, parseVersion: true, atsScore: true, confidence: true, lastParsedAt: true, updatedAt: true },
      }),
      prisma.userCertification.findMany({
        where: { userId: session.user.id },
        orderBy: { createdAt: 'desc' },
        select: { id: true, name: true, issuer: true, issueDate: true, expiryDate: true, credentialId: true, credentialUrl: true, createdAt: true },
      }),
    ]);

    const [gamification, analyticsRaw] = await Promise.all([
      getGamificationFromSnapshot({
        userId: session.user.id,
        latestResumeAtsScore: latestResume?.atsScore ?? null,
      }),
      prisma.userAnalytics.findUnique({
        where: { userId: session.user.id },
        select: { snapshot: true },
      }),
    ]);

    const todayUtc = new Date().toISOString().slice(0, 10);
    const rawSnap = analyticsRaw?.snapshot as { lastDailyClaimDate?: string } | null;
    const alreadyClaimedToday = rawSnap?.lastDailyClaimDate === todayUtc;

    const payload = { user, profile, skills, analytics, latestResume, certifications, gamification, alreadyClaimedToday };
    await cacheService.setJson(key, payload, 120);
    return NextResponse.json({ ok: true, source: 'db', data: payload });
  } catch (e) {
    return handleApiError(e);
  }
}
