import type { Course, CourseModule, Lesson, Quiz, UserCourse, LessonProgress } from '@prisma/client';
import { prisma } from '@/server/db/prisma';
import { getUserInsights } from '@/server/services/user-insights.service';

export type CourseWithDetails = Course & {
  modules: (CourseModule & {
    lessons: (Lesson & { quiz: Quiz | null; progress?: LessonProgress[] })[];
  })[];
  enrollment?: UserCourse | null;
};

function reverseLessonType(t: string): 'video' | 'reading' | 'quiz' | 'project' {
  if (t === 'VIDEO') return 'video';
  if (t === 'QUIZ') return 'quiz';
  if (t === 'PROJECT') return 'project';
  return 'reading';
}

function reverseDifficulty(d: string): 'Beginner' | 'Intermediate' | 'Advanced' {
  if (d === 'BEGINNER') return 'Beginner';
  if (d === 'ADVANCED') return 'Advanced';
  return 'Intermediate';
}

/** Map DB course to client GameContext Course shape. */
export function mapCourseToClient(
  course: CourseWithDetails,
  enrollment?: UserCourse | null,
) {
  const userCourseId = enrollment?.id;
  const lessonProgressMap = new Map<string, LessonProgress>();

  for (const mod of course.modules) {
    for (const les of mod.lessons) {
      const lp = les.progress?.[0];
      if (lp) lessonProgressMap.set(les.id, lp);
    }
  }

  const modules = course.modules.map((mod, modIdx) => {
    const lessons = mod.lessons.map(les => {
      const lp = lessonProgressMap.get(les.id);
      return {
        id: les.id,
        title: les.title,
        duration: les.duration,
        type: reverseLessonType(les.type),
        completed: Boolean(lp?.completed),
        content: les.content ?? undefined,
        quiz: les.quiz?.questions ?? undefined,
      };
    });
    const allCompleted = lessons.length > 0 && lessons.every(l => l.completed);
    const prevModule = modIdx > 0 ? course.modules[modIdx - 1] : null;
    const prevComplete = prevModule
      ? prevModule.lessons.every(l => lessonProgressMap.get(l.id)?.completed)
      : true;
    return {
      id: mod.id,
      title: mod.title,
      description: mod.description,
      locked: mod.locked && !prevComplete,
      completed: allCompleted,
      xpReward: mod.xpReward,
      lessons,
    };
  });

  const totalLessons = modules.flatMap(m => m.lessons).length;
  const completedLessons = modules.flatMap(m => m.lessons).filter(l => l.completed).length;
  const progress =
    enrollment?.progressPct ??
    (totalLessons ? Math.round((completedLessons / totalLessons) * 100) : 0);

  return {
    id: course.id,
    title: course.title,
    description: course.description,
    category: course.category,
    difficulty: reverseDifficulty(course.difficulty),
    estimatedDays: course.estimatedDays,
    totalXp: course.totalXp,
    progress,
    modules,
    thumbnail: course.thumbnail,
    tags: course.tags,
    aiGenerated: course.aiGenerated,
    status: enrollment?.status ?? 'ACTIVE',
    saved: enrollment?.saved ?? false,
    xpEarned: enrollment?.xpEarned ?? 0,
    timeSpentMinutes: enrollment?.timeSpentMinutes ?? 0,
    userCourseId,
  };
}

export async function listUserCoursesSummary(userId: string) {
  const enrollments = await prisma.userCourse.findMany({
    where: { userId },
    include: { course: true },
    orderBy: { lastAccessedAt: 'desc' },
  });

  return enrollments.map(e => ({
    id: e.course.id,
    title: e.course.title,
    description: e.course.description,
    category: e.course.category,
    difficulty: reverseDifficulty(e.course.difficulty),
    estimatedDays: e.course.estimatedDays,
    totalXp: e.course.totalXp,
    progress: e.progressPct,
    modules: [] as ReturnType<typeof mapCourseToClient>['modules'],
    thumbnail: e.course.thumbnail,
    tags: e.course.tags,
    aiGenerated: e.course.aiGenerated,
    status: e.status,
    saved: e.saved,
    xpEarned: e.xpEarned,
    timeSpentMinutes: e.timeSpentMinutes,
    userCourseId: e.id,
  }));
}

export async function listUserCourses(userId: string) {
  const enrollments = await prisma.userCourse.findMany({
    where: { userId },
    include: {
      course: {
        include: {
          modules: {
            orderBy: { orderIndex: 'asc' },
            include: {
              lessons: {
                orderBy: { orderIndex: 'asc' },
                include: {
                  quiz: true,
                  progress: { where: { userCourse: { userId } } },
                },
              },
            },
          },
        },
      },
    },
    orderBy: { lastAccessedAt: 'desc' },
  });

  return enrollments.map(e => mapCourseToClient(e.course as CourseWithDetails, e));
}

export async function getCourseForUser(userId: string, courseId: string) {
  const enrollment = await prisma.userCourse.findUnique({
    where: { userId_courseId: { userId, courseId } },
    include: {
      course: {
        include: {
          modules: {
            orderBy: { orderIndex: 'asc' },
            include: {
              lessons: {
                orderBy: { orderIndex: 'asc' },
                include: {
                  quiz: true,
                  progress: { where: { userCourse: { userId } } },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!enrollment) {
    const course = await prisma.course.findFirst({
      where: { id: courseId, deletedAt: null },
      include: {
        modules: {
          orderBy: { orderIndex: 'asc' },
          include: {
            lessons: { orderBy: { orderIndex: 'asc' }, include: { quiz: true } },
          },
        },
      },
    });
    if (!course) return null;

    await enrollUserInCourse(userId, courseId);
    const freshEnrollment = await prisma.userCourse.findUnique({
      where: { userId_courseId: { userId, courseId } },
      include: {
        course: {
          include: {
            modules: {
              orderBy: { orderIndex: 'asc' },
              include: {
                lessons: {
                  orderBy: { orderIndex: 'asc' },
                  include: {
                    quiz: true,
                    progress: { where: { userCourse: { userId } } },
                  },
                },
              },
            },
          },
        },
      },
    });
    if (freshEnrollment) {
      return mapCourseToClient(freshEnrollment.course as CourseWithDetails, freshEnrollment);
    }
    return mapCourseToClient(course as CourseWithDetails, null);
  }

  await prisma.userCourse.update({
    where: { id: enrollment.id },
    data: { lastAccessedAt: new Date() },
  });

  return mapCourseToClient(enrollment.course as CourseWithDetails, enrollment);
}

export async function enrollUserInCourse(userId: string, courseId: string) {
  const course = await prisma.course.findFirst({
    where: { id: courseId, deletedAt: null },
  });
  if (!course) return null;

  const enrollment = await prisma.userCourse.upsert({
    where: { userId_courseId: { userId, courseId } },
    create: { userId, courseId, status: 'ACTIVE' },
    update: { lastAccessedAt: new Date(), status: 'ACTIVE' },
  });

  return enrollment;
}

export async function getRecommendedCourses(userId: string, limit = 6) {
  const insights = await getUserInsights(userId);
  const fromInsights = Array.isArray(insights?.recommendedCourses)
    ? (insights!.recommendedCourses as Array<{
        title: string;
        difficulty?: string;
        days?: number;
        tags?: string[];
        reason?: string;
        courseId?: string;
      }>)
    : [];

  const enrolledIds = (
    await prisma.userCourse.findMany({ where: { userId }, select: { courseId: true } })
  ).map(e => e.courseId);

  if (fromInsights.length > 0) {
    return fromInsights.slice(0, limit).map((r, i) => ({
      id: r.courseId ?? `insight-${i}`,
      title: r.title,
      thumbnail: '📚',
      difficulty: r.difficulty ?? 'Intermediate',
      days: r.days ?? 14,
      xp: 900,
      tags: r.tags ?? [],
      locked: false,
      courseId: r.courseId ?? null,
    }));
  }

  const profile = await prisma.profile.findUnique({ where: { userId } });

  const recs = await prisma.aiRecommendation.findMany({
    where: {
      userId,
      kind: 'LEARNING',
      dismissed: false,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    orderBy: { score: 'desc' },
    take: limit,
  });

  if (recs.length > 0) {
    return recs.map(r => {
      const p = r.payload as { title?: string; difficulty?: string; estimatedHours?: number; courseId?: string };
      return {
        id: (p.courseId as string | undefined) ?? r.id,
        title: p.title ?? 'Recommended course',
        thumbnail: '📚',
        difficulty: p.difficulty ?? 'intermediate',
        days: p.estimatedHours ? Math.max(3, Math.round(p.estimatedHours / 2)) : 14,
        xp: 900,
        tags: [] as string[],
        locked: false,
        courseId: (p.courseId as string | undefined) ?? null,
      };
    });
  }

  const target = profile?.targetRole ?? 'Professional Growth';
  return [
    { id: 'rec-1', title: `${target} Essentials`, thumbnail: '🎯', difficulty: 'Intermediate', days: 14, xp: 1200, tags: [target], locked: false, courseId: null },
    { id: 'rec-2', title: 'Leadership Foundations', thumbnail: '🚀', difficulty: 'Advanced', days: 21, xp: 1800, tags: ['Leadership'], locked: false, courseId: null },
  ].filter(r => !enrolledIds.includes(r.id));
}
