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
}): number {
  const { lastActiveDate, today, yesterday, currentStreak } = args;
  if (!lastActiveDate) return 1;
  if (lastActiveDate === today) return currentStreak;
  if (lastActiveDate === yesterday) return currentStreak + 1;
  return 1;
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
}): Promise<{ xp: number; streak: number; badges: Badge[] }> {
  const { userId, amount } = args;

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

  const nextStreak = computeNextStreak({
    lastActiveDate: snap.lastActiveDate,
    today,
    yesterday,
    currentStreak: snap.streak,
  });

  const nextSnapBase: GamificationSnapshot = {
    ...snap,
    xp: snap.xp + amount,
    streak: nextStreak,
    lastActiveDate: today,
  };

  const { nextSnap } = applyBadgeCriteria({ snap: nextSnapBase, atsScore, nowIso });

  await prisma.userAnalytics.upsert({
    where: { userId },
    create: {
      userId,
      lastActiveAt: now,
      snapshot: nextSnap as Prisma.InputJsonValue,
    },
    update: {
      snapshot: nextSnap as Prisma.InputJsonValue,
      lastActiveAt: now,
    },
  });

  // Invalidate cached user hydration.
  void cacheService.invalidateUser(userId);

  return { xp: nextSnap.xp, streak: nextSnap.streak, badges: buildBadgesFromSnapshot({ snap: nextSnap }) };
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

  const nextStreak = computeNextStreak({
    lastActiveDate: snap.lastActiveDate,
    today,
    yesterday,
    currentStreak: snap.streak,
  });

  const nextSnapBase: GamificationSnapshot = {
    ...snap,
    xp: snap.xp + DAILY_BONUS_XP,
    streak: nextStreak,
    lastActiveDate: today,
    lastDailyClaimDate: today,
  };

  const { nextSnap } = applyBadgeCriteria({ snap: nextSnapBase, atsScore, nowIso });

  await prisma.userAnalytics.upsert({
    where: { userId },
    create: {
      userId,
      lastActiveAt: now,
      snapshot: nextSnap as Prisma.InputJsonValue,
    },
    update: {
      snapshot: nextSnap as Prisma.InputJsonValue,
      lastActiveAt: now,
    },
  });

  void cacheService.invalidateUser(userId);

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

  await prisma.userAnalytics.update({
    where: { userId },
    data: { snapshot: nextSnap as Prisma.InputJsonValue },
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
      lastDailyClaimDate: null,
      earnedBadges: {},
    };
    return { xp: empty.xp, streak: empty.streak, badges: buildBadgesFromSnapshot({ snap: empty }) };
  }

  const snap = parseSnapshot(analytics.snapshot);
  const nowIso = new Date().toISOString();
  const { nextSnap, changed } = applyBadgeCriteria({ snap, atsScore: args.latestResumeAtsScore, nowIso });

  if (changed) {
    await prisma.userAnalytics.update({
      where: { userId },
      data: { snapshot: nextSnap as Prisma.InputJsonValue },
    });
    void cacheService.invalidateUser(userId);
  }

  return { xp: nextSnap.xp, streak: nextSnap.streak, badges: buildBadgesFromSnapshot({ snap: nextSnap }) };
}

