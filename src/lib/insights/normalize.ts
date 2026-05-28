import type { UserInsightsPayload } from '@/server/services/user-insights.service';

export type SkillGapItem = { skill: string; priority: string; reason?: string };

export type NormalizedCourseRec = {
  title: string;
  difficulty: string;
  days: number;
  tags: string[];
  reason: string;
  courseId?: string;
};

export type NormalizedProfileInsights = {
  careerGoals: string[];
  targetRoles: string[];
  recommendedCourses: NormalizedCourseRec[];
  salaryInsights: Record<string, unknown> | null;
  skillsGap: SkillGapItem[];
  /** Flat skill names from skillsGap, high-priority first */
  recommendedSkills: string[];
  careerPath: UserInsightsPayload['careerPath'];
  industry?: string;
  cached: boolean;
  profileVersion: number;
};

function asStringList(raw: unknown, max = 12): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(x => String(x).trim()).filter(Boolean).slice(0, max);
}

function asSkillsGap(raw: unknown): SkillGapItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map(item => {
      if (!item || typeof item !== 'object') return null;
      const o = item as Record<string, unknown>;
      const skill = String(o.skill ?? '').trim();
      if (!skill) return null;
      return {
        skill,
        priority: String(o.priority ?? 'medium'),
        reason: typeof o.reason === 'string' ? o.reason : undefined,
      };
    })
    .filter(Boolean) as SkillGapItem[];
}

function asCourses(raw: unknown): NormalizedCourseRec[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map(item => {
      if (!item || typeof item !== 'object') return null;
      const o = item as Record<string, unknown>;
      const title = String(o.title ?? '').trim();
      if (!title) return null;
      return {
        title,
        difficulty: String(o.difficulty ?? 'Intermediate'),
        days: Number(o.days ?? 7) || 7,
        tags: asStringList(o.tags, 8),
        reason: String(o.reason ?? ''),
        courseId: typeof o.courseId === 'string' ? o.courseId : undefined,
      };
    })
    .filter(Boolean) as NormalizedCourseRec[];
}

const PRIORITY_RANK: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

export function normalizeUserInsights(
  raw: unknown,
  opts?: { cached?: boolean; profileVersion?: number },
): NormalizedProfileInsights {
  const data = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const insights = (data.insights && typeof data.insights === 'object'
    ? data.insights
    : data) as Record<string, unknown>;

  const skillsGap = asSkillsGap(insights.skillsGap);
  const recommendedSkills = [...skillsGap]
    .sort((a, b) => (PRIORITY_RANK[a.priority] ?? 2) - (PRIORITY_RANK[b.priority] ?? 2))
    .map(s => s.skill)
    .filter((s, i, arr) => arr.indexOf(s) === i);

  const salaryRaw = insights.salaryInsights;
  const salaryInsights =
    salaryRaw && typeof salaryRaw === 'object' && Object.keys(salaryRaw as object).length > 0
      ? (salaryRaw as Record<string, unknown>)
      : null;

  return {
    careerGoals: asStringList(insights.careerGoals, 8),
    targetRoles: asStringList(insights.targetRoles, 6),
    recommendedCourses: asCourses(insights.recommendedCourses),
    salaryInsights,
    skillsGap,
    recommendedSkills,
    careerPath: (insights.careerPath ?? {}) as NormalizedProfileInsights['careerPath'],
    industry: typeof insights.industry === 'string' ? insights.industry : undefined,
    cached: Boolean(opts?.cached ?? data.cached ?? insights.cached),
    profileVersion: Number(opts?.profileVersion ?? data.profileVersion ?? insights.profileVersion ?? 0),
  };
}

/** Build radar chart rows from user skills + insights gap (0–100 heuristic). */
export function buildSkillRadarFromInsights(args: {
  userSkills: string[];
  skillsGap: SkillGapItem[];
  maxItems?: number;
}): Array<{ skill: string; value: number }> {
  const max = args.maxItems ?? 6;
  const owned = args.userSkills.slice(0, max).map((skill, i) => ({
    skill,
    value: Math.min(95, 72 + i * 4),
  }));

  for (const gap of args.skillsGap) {
    if (owned.length >= max) break;
    if (owned.some(o => o.skill.toLowerCase() === gap.skill.toLowerCase())) continue;
    const priority = gap.priority?.toLowerCase() ?? 'medium';
    const value = priority === 'critical' ? 28 : priority === 'high' ? 38 : priority === 'low' ? 52 : 45;
    owned.push({ skill: gap.skill, value });
  }

  return owned.slice(0, max);
}
