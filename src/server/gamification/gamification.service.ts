import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '@/server/db/prisma';
import { cacheService } from '@/server/cache/cache-service';
import { badgeCatalog } from './badge-catalog';
import type { Badge } from '@/components/GameContext';

const isoDay = {
  today(now = new Date()) {
    return now.toISOString().slice(0, 10);
  },
  yesterday(now = new Date()) {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - 1);
    return d.toISOString().slice(0, 10);
  },
};

  /** Streak advances at most once per UTC calendar day of activity. */
export function computeNextStreak(args: {
  lastActiveDate: string | null | undefined;
  today: string;
  yesterday: string;
  currentStreak: number;
}): { streak: number; streakStartedAt: string | null } {
  const { lastActiveDate, today, yesterday, currentStreak } = args;
  if (!lastActiveDate) return { streak: 1, streakStartedAt: today };
  if (lastActiveDate === today) return { streak: Math.max(currentStreak, 1), streakStartedAt: null };
  if (lastActiveDate === yesterday) return { streak: Math.max(currentStreak, 0) + 1, streakStartedAt: null };
  return { streak: 1, streakStartedAt: today };
}

const earnedBadgesSchema = z.preprocess(
  val => (val && typeof val === 'object' ? val : {}),
  z.record(z.unknown()).transform(raw => {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(raw)) {
      if (v != null && v !== '') out[k] = String(v);
    }
    return out;
  }),
);

const snapshotSchema = z
  .object({
    v: z.number().int().default(1),
    xp: z.number().int().nonnegative().default(0),
    streak: z.number().int().nonnegative().default(0),
    lastActiveDate: z.string().nullable().optional().default(null),
    /** UTC day when the current streak run began (reset on missed day). */
    streakStartedAt: z.string().nullable().optional().default(null),
    /** YYYY-MM-DD (UTC) of last daily bonus claim — prevents duplicate +25 XP. */
    lastDailyClaimDate: z.string().nullable().optional().default(null),
    earnedBadges: earnedBadgesSchema.optional().default({}),
  })
  .strip();

export type GamificationSnapshot = z.infer<typeof snapshotSchema>;

function parseSnapshot(snapshot: unknown): GamificationSnapshot {
  const fallback: GamificationSnapshot = {
    v: 1,
    xp: 0,
    streak: 0,
    lastActiveDate: null,
    streakStartedAt: null,
    lastDailyClaimDate: null,
    earnedBadges: {},
  };
  if (!snapshot) return fallback;

  const parsed = snapshotSchema.safeParse(snapshot);
  if (!parsed.success) return fallback;
  return parsed.data;
}

function buildBadgesFromSnapshot(args: { snap: GamificationSnapshot }): Badge[] {
  const { snap } = args;
  const earned = snap.earnedBadges ?? {};
  return badgeCatalog.map(b => ({
    ...b,
    earnedAt: earned[b.id] != null ? String(earned[b.id]) : null,
  }));
}

async function mergedSnapshotPayload(userId: string, nextSnap: GamificationSnapshot): Promise<Prisma.InputJsonValue> {
  const { mergeSnapshotWithGamification } = await import('@/server/services/analytics-history.service');
  return mergeSnapshotWithGamification(userId, nextSnap);
}

function applyBadgeCriteria(args: {
  snap: GamificationSnapshot;
  atsScore: number | null;
  nowIso: string;
}): { nextSnap: GamificationSnapshot; changed: boolean } {
  const { snap, atsScore, nowIso } = args;

  let earnedBadges = { ...(snap.earnedBadges ?? {}) } as Record<string, string>;
  let changed = false;

  const award = (id: string, condition: boolean) => {
    if (!condition) return;
    if (earnedBadges[id]) return;
    earnedBadges[id] = nowIso;
    changed = true;
  };

  award('badge-week-warrior', snap.streak >= 7);
  award('badge-hot-streak', snap.streak >= 3);
  award('badge-ats-expert', (atsScore ?? 0) >= 80);
  award('badge-xp-500', snap.xp >= 500);
  award('badge-xp-1500', snap.xp >= 1500);

  const nextSnap: GamificationSnapshot = { ...snap, earnedBadges };
  return { nextSnap, changed };
}

export async function awardGamificationXp(args: {
  userId: string;
  amount: number;
  /** Unique key for idempotent XP (e.g. lesson:abc:2026-05-22). Skips XP if already awarded. */
  actionKey?: string;
  actionType?: string;
}): Promise<{ xp: number; streak: number; badges: Badge[]; awarded: boolean }> {
  const { userId, amount, actionKey, actionType = 'XP' } = args;

  if (actionKey) {
    const dup = await prisma.gamificationEvent.findUnique({
      where: { userId_actionKey: { userId, actionKey } },
    });
    if (dup) {
      const snap = parseSnapshot(
        (await prisma.userAnalytics.findUnique({ where: { userId }, select: { snapshot: true } }))?.snapshot,
      );
      return {
        xp: snap.xp,
        streak: snap.streak,
        badges: buildBadgesFromSnapshot({ snap }),
        awarded: false,
      };
    }
  }

  const now = new Date();
  const today = isoDay.today(now);
  const yesterday = isoDay.yesterday(now);
  const nowIso = now.toISOString();

  const latestResume = await prisma.resume.findFirst({
    where: { userId, deletedAt: null, parseStatus: 'COMPLETE' },
    orderBy: { updatedAt: 'desc' },
    select: { atsScore: true },
  });

  const atsScore = latestResume?.atsScore ?? null;

  const existing = await prisma.userAnalytics.findUnique({
    where: { userId },
    select: { snapshot: true },
  });

  const snap = parseSnapshot(existing?.snapshot);

  const nextStreakResult = computeNextStreak({
    lastActiveDate: snap.lastActiveDate,
    today,
    yesterday,
    currentStreak: snap.streak,
  });

  const nextSnapBase: GamificationSnapshot = {
    ...snap,
    xp: snap.xp + amount,
    streak: nextStreakResult.streak,
    lastActiveDate: today,
    streakStartedAt: nextStreakResult.streakStartedAt ?? snap.streakStartedAt ?? today,
  };

  const { nextSnap } = applyBadgeCriteria({ snap: nextSnapBase, atsScore, nowIso });
  const merged = await mergedSnapshotPayload(userId, nextSnap);

  await prisma.$transaction(async tx => {
    await tx.userAnalytics.upsert({
      where: { userId },
      create: {
        userId,
        lastActiveAt: now,
        snapshot: merged,
      },
      update: {
        snapshot: merged,
        lastActiveAt: now,
      },
    });

    if (actionKey) {
      await tx.gamificationEvent.create({
        data: {
          userId,
          actionKey,
          actionType,
          xpAmount: amount,
        },
      });
    }
  });

  // Invalidate cached user hydration.
  void cacheService.invalidateUser(userId);
  void import('@/server/services/analytics-history.service').then(({ appendXpHistoryPoint }) =>
    appendXpHistoryPoint(userId, nextSnap.xp),
  );

  return {
    xp: nextSnap.xp,
    streak: nextSnap.streak,
    badges: buildBadgesFromSnapshot({ snap: nextSnap }),
    awarded: true,
  };
}

/** Deduct XP for AI feature usage. Idempotent via actionKey. */
export async function spendGamificationXp(args: {
  userId: string;
  amount: number;
  actionKey: string;
  actionType: string;
}): Promise<{ xp: number; spent: boolean; required: number }> {
  const { userId, amount, actionKey, actionType } = args;
  if (amount <= 0) {
    const snap = parseSnapshot(
      (await prisma.userAnalytics.findUnique({ where: { userId }, select: { snapshot: true } }))?.snapshot,
    );
    return { xp: snap.xp, spent: false, required: amount };
  }

  const dup = await prisma.gamificationEvent.findUnique({
    where: { userId_actionKey: { userId, actionKey } },
  });
  if (dup) {
    const snap = parseSnapshot(
      (await prisma.userAnalytics.findUnique({ where: { userId }, select: { snapshot: true } }))?.snapshot,
    );
    return { xp: snap.xp, spent: false, required: amount };
  }

  const existing = await prisma.userAnalytics.findUnique({
    where: { userId },
    select: { snapshot: true },
  });
  const snap = parseSnapshot(existing?.snapshot);

  if (snap.xp < amount) {
    const { insufficientXp } = await import('@/server/errors/http-error');
    const { XP_EARN_SUGGESTIONS } = await import('@/lib/gamification/xp-costs');
    throw insufficientXp('Not enough XP for this action', {
      required: amount,
      balance: snap.xp,
      suggestions: XP_EARN_SUGGESTIONS,
    });
  }

  const nextSnap: GamificationSnapshot = { ...snap, xp: snap.xp - amount };
  const merged = await mergedSnapshotPayload(userId, nextSnap);

  await prisma.$transaction(async tx => {
    await tx.userAnalytics.upsert({
      where: { userId },
      create: {
        userId,
        lastActiveAt: new Date(),
        snapshot: merged,
      },
      update: {
        snapshot: merged,
      },
    });
    await tx.gamificationEvent.create({
      data: {
        userId,
        actionKey,
        actionType,
        xpAmount: -amount,
      },
    });
  });

  void cacheService.invalidateUser(userId);

  return { xp: nextSnap.xp, spent: true, required: amount };
}

export async function getGamificationXpBalance(userId: string): Promise<number> {
  const row = await prisma.userAnalytics.findUnique({
    where: { userId },
    select: { snapshot: true },
  });
  return parseSnapshot(row?.snapshot).xp;
}

const DAILY_BONUS_XP = 25;

/**
 * Idempotent daily dashboard bonus: +XP once per UTC day, streak follows same rules as other activity.
 */
export async function claimDailyBonus(userId: string): Promise<{
  claimed: boolean;
  xp: number;
  streak: number;
  badges: Badge[];
}> {
  const now = new Date();
  const today = isoDay.today(now);
  const yesterday = isoDay.yesterday(now);
  const nowIso = now.toISOString();

  const latestResume = await prisma.resume.findFirst({
    where: { userId, deletedAt: null, parseStatus: 'COMPLETE' },
    orderBy: { updatedAt: 'desc' },
    select: { atsScore: true },
  });
  const atsScore = latestResume?.atsScore ?? null;

  const existing = await prisma.userAnalytics.findUnique({
    where: { userId },
    select: { snapshot: true },
  });

  const snap = parseSnapshot(existing?.snapshot);

  if (snap.lastDailyClaimDate === today) {
    return {
      claimed: false,
      xp: snap.xp,
      streak: snap.streak,
      badges: buildBadgesFromSnapshot({ snap }),
    };
  }

  const nextStreakResult = computeNextStreak({
    lastActiveDate: snap.lastActiveDate,
    today,
    yesterday,
    currentStreak: snap.streak,
  });

  const nextSnapBase: GamificationSnapshot = {
    ...snap,
    xp: snap.xp + DAILY_BONUS_XP,
    streak: nextStreakResult.streak,
    lastActiveDate: today,
    lastDailyClaimDate: today,
    streakStartedAt: nextStreakResult.streakStartedAt ?? snap.streakStartedAt ?? today,
  };

  const { nextSnap } = applyBadgeCriteria({ snap: nextSnapBase, atsScore, nowIso });
  const merged = await mergedSnapshotPayload(userId, nextSnap);

  await prisma.userAnalytics.upsert({
    where: { userId },
    create: {
      userId,
      lastActiveAt: now,
      snapshot: merged,
    },
    update: {
      snapshot: merged,
      lastActiveAt: now,
    },
  });

  void cacheService.invalidateUser(userId);
  void import('@/server/services/analytics-history.service').then(({ appendXpHistoryPoint }) =>
    appendXpHistoryPoint(userId, nextSnap.xp),
  );

  return {
    claimed: true,
    xp: nextSnap.xp,
    streak: nextSnap.streak,
    badges: buildBadgesFromSnapshot({ snap: nextSnap }),
  };
}

export async function recomputeGamificationBadgesForUser(userId: string): Promise<void> {
  const nowIso = new Date().toISOString();

  const analytics = await prisma.userAnalytics.findUnique({
    where: { userId },
    select: { snapshot: true },
  });
  if (!analytics) return;

  const snap = parseSnapshot(analytics.snapshot);

  const latestResume = await prisma.resume.findFirst({
    where: { userId, deletedAt: null, parseStatus: 'COMPLETE' },
    orderBy: { updatedAt: 'desc' },
    select: { atsScore: true },
  });

  const atsScore = latestResume?.atsScore ?? null;

  const { nextSnap } = applyBadgeCriteria({ snap, atsScore, nowIso });
  if (JSON.stringify(nextSnap) === JSON.stringify(snap)) return;

  const merged = await mergedSnapshotPayload(userId, nextSnap);
  await prisma.userAnalytics.update({
    where: { userId },
    data: { snapshot: merged },
  });

  void cacheService.invalidateUser(userId);
}

export async function getGamificationFromSnapshot(args: {
  userId: string;
  latestResumeAtsScore: number | null;
}): Promise<{ xp: number; streak: number; badges: Badge[] }> {
  const { userId } = args;
  const analytics = await prisma.userAnalytics.findUnique({
    where: { userId },
    select: { snapshot: true },
  });

  if (!analytics?.snapshot) {
    const empty: GamificationSnapshot = {
      v: 1,
      xp: 0,
      streak: 0,
      lastActiveDate: null,
      streakStartedAt: null,
      lastDailyClaimDate: null,
      earnedBadges: {},
    };
    return { xp: empty.xp, streak: empty.streak, badges: buildBadgesFromSnapshot({ snap: empty }) };
  }

  const snap = parseSnapshot(analytics.snapshot);
  const nowIso = new Date().toISOString();
  const { nextSnap, changed } = applyBadgeCriteria({ snap, atsScore: args.latestResumeAtsScore, nowIso });

  if (changed) {
    const merged = await mergedSnapshotPayload(userId, nextSnap);
    await prisma.userAnalytics.update({
      where: { userId },
      data: { snapshot: merged },
    });
    void cacheService.invalidateUser(userId);
  }

  return { xp: nextSnap.xp, streak: nextSnap.streak, badges: buildBadgesFromSnapshot({ snap: nextSnap }) };
}

