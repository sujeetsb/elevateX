import type { NormalizedCourseRec } from '@/lib/insights/normalize';

/** UI shape for Courses page recommended cards (matches server getRecommendedCourses). */
export type InsightRecommendedCourse = {
  id: string;
  title: string;
  thumbnail: string;
  difficulty: string;
  days: number;
  xp: number;
  tags: string[];
  locked: boolean;
  courseId: string | null;
  reason?: string;
};

export function mapInsightCoursesToRecommended(
  courses: NormalizedCourseRec[] | undefined,
  limit = 6,
): InsightRecommendedCourse[] {
  if (!courses?.length) return [];
  return courses.slice(0, limit).map((r, i) => ({
    id: r.courseId ?? `insight-${i}`,
    title: r.title,
    thumbnail: '📚',
    difficulty: r.difficulty,
    days: r.days,
    xp: r.days * 40,
    tags: r.tags,
    locked: false,
    courseId: r.courseId ?? null,
    reason: r.reason,
  }));
}
