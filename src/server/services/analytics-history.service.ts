import { Prisma } from '@prisma/client';
import { prisma } from '@/server/db/prisma';

const MAX_POINTS = 52;

export type XpHistoryPoint = { date: string; xp: number };
export type SkillHistoryPoint = { date: string; skills: Array<{ skill: string; value: number }> };
export type SalaryHistoryPoint = {
  date: string;
  current: string | null;
  goal: string | null;
  currency: string;
  goalCurrency: string;
};

export type AnalyticsHistory = {
  xpHistory: XpHistoryPoint[];
  skillHistory: SkillHistoryPoint[];
  salaryHistory: SalaryHistoryPoint[];
};

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

function trimHistory<T>(arr: T[]): T[] {
  return arr.length > MAX_POINTS ? arr.slice(-MAX_POINTS) : arr;
}

async function readSnapshotRaw(userId: string): Promise<Record<string, unknown>> {
  const row = await prisma.userAnalytics.findUnique({
    where: { userId },
    select: { snapshot: true },
  });
  if (!row?.snapshot || typeof row.snapshot !== 'object') return {};
  return row.snapshot as Record<string, unknown>;
}

/** Merge gamification fields without dropping analytics history arrays. */
export async function mergeSnapshotWithGamification(
  userId: string,
  gamification: Record<string, unknown>,
): Promise<Prisma.InputJsonValue> {
  const raw = await readSnapshotRaw(userId);
  return { ...raw, ...gamification } as Prisma.InputJsonValue;
}

function parseHistoryArrays(raw: Record<string, unknown>): AnalyticsHistory {
  const xpHistory = Array.isArray(raw.xpHistory)
    ? (raw.xpHistory as XpHistoryPoint[]).filter(p => p?.date && typeof p.xp === 'number')
    : [];
  const skillHistory = Array.isArray(raw.skillHistory)
    ? (raw.skillHistory as SkillHistoryPoint[]).filter(p => p?.date && Array.isArray(p.skills))
    : [];
  const salaryHistory = Array.isArray(raw.salaryHistory)
    ? (raw.salaryHistory as SalaryHistoryPoint[]).filter(p => p?.date)
    : [];
  return { xpHistory, skillHistory, salaryHistory };
}

async function writeSnapshotMerge(userId: string, patch: Record<string, unknown>) {
  const raw = await readSnapshotRaw(userId);
  const merged = { ...raw, ...patch };
  await prisma.userAnalytics.upsert({
    where: { userId },
    create: { userId, snapshot: merged as Prisma.InputJsonValue },
    update: { snapshot: merged as Prisma.InputJsonValue },
  });
}

export async function getAnalyticsHistory(userId: string): Promise<AnalyticsHistory> {
  const raw = await readSnapshotRaw(userId);
  return parseHistoryArrays(raw);
}

export async function appendXpHistoryPoint(userId: string, xp: number) {
  const date = todayUtc();
  const history = await getAnalyticsHistory(userId);
  const last = history.xpHistory[history.xpHistory.length - 1];
  const next =
    last?.date === date
      ? [...history.xpHistory.slice(0, -1), { date, xp }]
      : [...history.xpHistory, { date, xp }];
  await writeSnapshotMerge(userId, { xpHistory: trimHistory(next) });
}

export async function appendSkillHistoryPoint(userId: string, skills: string[]) {
  if (!skills.length) return;
  const date = todayUtc();
  const history = await getAnalyticsHistory(userId);
  const point: SkillHistoryPoint = {
    date,
    skills: skills.slice(0, 12).map((skill, i) => ({
      skill,
      value: Math.min(95, 55 + i * 4),
    })),
  };
  const last = history.skillHistory[history.skillHistory.length - 1];
  const next =
    last?.date === date
      ? [...history.skillHistory.slice(0, -1), point]
      : [...history.skillHistory, point];
  await writeSnapshotMerge(userId, { skillHistory: trimHistory(next) });
}

export async function appendSalaryHistoryPoint(
  userId: string,
  salary: {
    current: string | null;
    goal: string | null;
    currency: string;
    goalCurrency: string;
  },
) {
  const date = todayUtc();
  const history = await getAnalyticsHistory(userId);
  const point: SalaryHistoryPoint = { date, ...salary };
  const last = history.salaryHistory[history.salaryHistory.length - 1];
  const unchanged =
    last &&
    last.current === point.current &&
    last.goal === point.goal &&
    last.currency === point.currency &&
    last.goalCurrency === point.goalCurrency;
  if (unchanged) return;

  const next =
    last?.date === date
      ? [...history.salaryHistory.slice(0, -1), point]
      : [...history.salaryHistory, point];
  await writeSnapshotMerge(userId, { salaryHistory: trimHistory(next) });
}

/** Backfill history from existing events/profile when arrays are empty. */
export async function ensureAnalyticsHistoryBackfill(userId: string): Promise<AnalyticsHistory> {
  let history = await getAnalyticsHistory(userId);
  let patched = false;

  if (history.xpHistory.length === 0) {
    const events = await prisma.gamificationEvent.findMany({
      where: { userId, xpAmount: { gt: 0 } },
      orderBy: { createdAt: 'asc' },
      take: 80,
      select: { createdAt: true, xpAmount: true },
    });
    if (events.length > 0) {
      let running = 0;
      const byDate = new Map<string, number>();
      for (const ev of events) {
        running += ev.xpAmount;
        byDate.set(ev.createdAt.toISOString().slice(0, 10), running);
      }
      history = {
        ...history,
        xpHistory: [...byDate.entries()].map(([date, xp]) => ({ date, xp })),
      };
      patched = true;
    }
  }

  if (history.salaryHistory.length === 0) {
    const profile = await prisma.profile.findUnique({
      where: { userId },
      select: {
        currentSalary: true,
        salaryExpectation: true,
        salaryCurrency: true,
        salaryGoalCurrency: true,
      },
    });
    if (profile?.currentSalary || profile?.salaryExpectation) {
      history = {
        ...history,
        salaryHistory: [
          {
            date: todayUtc(),
            current: profile.currentSalary,
            goal: profile.salaryExpectation,
            currency: profile.salaryCurrency ?? 'USD',
            goalCurrency: profile.salaryGoalCurrency ?? profile.salaryCurrency ?? 'USD',
          },
        ],
      };
      patched = true;
    }
  }

  if (history.skillHistory.length === 0) {
    const skills = await prisma.userSkill.findMany({
      where: { userId },
      take: 12,
      include: { skill: true },
    });
    if (skills.length >= 3) {
      history = {
        ...history,
        skillHistory: [
          {
            date: todayUtc(),
            skills: skills.map((us, i) => ({
              skill: us.skill.label,
              value: Math.min(95, 55 + i * 4),
            })),
          },
        ],
      };
      patched = true;
    }
  }

  if (patched) {
    await writeSnapshotMerge(userId, {
      xpHistory: history.xpHistory,
      skillHistory: history.skillHistory,
      salaryHistory: history.salaryHistory,
    });
  }

  return history;
}

export function salaryTrendFromHistory(
  history: SalaryHistoryPoint[],
): Array<{ label: string; current: number | null; goal: number | null }> {
  return history.slice(-12).map(p => ({
    label: p.date.slice(5),
    current: p.current ? Number(String(p.current).replace(/[^\d.]/g, '')) || null : null,
    goal: p.goal ? Number(String(p.goal).replace(/[^\d.]/g, '')) || null : null,
  }));
}

export function skillGrowthFromHistory(
  history: SkillHistoryPoint[],
): Array<Record<string, string | number>> {
  if (history.length < 2) return [];
  const recent = history.slice(-6);
  const skillNames = [...new Set(recent.flatMap(p => p.skills.map(s => s.skill)))].slice(0, 4);
  return recent.map(p => {
    const row: Record<string, string | number> = { month: p.date.slice(5) };
    for (const name of skillNames) {
      const match = p.skills.find(s => s.skill === name);
      row[name] = match?.value ?? 0;
    }
    return row;
  });
}
