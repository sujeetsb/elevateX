import { prisma } from '@/server/db/prisma';
import { cacheService } from '@/server/cache/cache-service';
import { inngest } from '@/server/inngest/client';
import { awardGamificationXp } from '@/server/gamification/gamification.service';
import type { ActivityVerb } from '@prisma/client';

const isoDay = {
  today(now = new Date()) {
    return now.toISOString().slice(0, 10);
  },
};

export async function completeLessonForUser(args: {
  userId: string;
  courseId: string;
  lessonId: string;
  quizScore?: number;
  timeSpentMinutes?: number;
}) {
  const { userId, courseId, lessonId, quizScore, timeSpentMinutes = 5 } = args;

  const enrollment = await prisma.userCourse.findUnique({
    where: { userId_courseId: { userId, courseId } },
    include: {
      course: {
        include: {
          modules: {
            orderBy: { orderIndex: 'asc' },
            include: { lessons: { orderBy: { orderIndex: 'asc' } } },
          },
        },
      },
      lessonProgress: true,
    },
  });

  if (!enrollment) throw new Error('Not enrolled in course');

  const lesson = enrollment.course.modules.flatMap(m => m.lessons).find(l => l.id === lessonId);
  if (!lesson) throw new Error('Lesson not found');

  const today = isoDay.today();
  const actionKey = `lesson:${lessonId}:${today}`;

  const existingEvent = await prisma.gamificationEvent.findUnique({
    where: { userId_actionKey: { userId, actionKey } },
  });

  let xpAwarded = 0;
  if (!existingEvent) {
    xpAwarded = lesson.xpReward;
    await awardGamificationXp({ userId, amount: xpAwarded, actionKey, actionType: 'LESSON_COMPLETE' });
  }

  await prisma.$transaction(async tx => {
    await tx.lessonProgress.upsert({
      where: { userCourseId_lessonId: { userCourseId: enrollment.id, lessonId } },
      create: {
        userCourseId: enrollment.id,
        lessonId,
        completed: true,
        completedAt: new Date(),
        quizScore: quizScore ?? null,
        timeSpentMinutes,
      },
      update: {
        completed: true,
        completedAt: new Date(),
        quizScore: quizScore ?? undefined,
        timeSpentMinutes: { increment: timeSpentMinutes },
      },
    });

    const allLessons = enrollment.course.modules.flatMap(m => m.lessons);
    const completedCount = await tx.lessonProgress.count({
      where: { userCourseId: enrollment.id, completed: true },
    });
    const progressPct = allLessons.length
      ? Math.round((completedCount / allLessons.length) * 100)
      : 0;

    await tx.userCourse.update({
      where: { id: enrollment.id },
      data: {
        progressPct,
        xpEarned: { increment: xpAwarded },
        timeSpentMinutes: { increment: timeSpentMinutes },
        lastAccessedAt: new Date(),
      },
    });

    await tx.userAnalytics.upsert({
      where: { userId },
      create: { userId, learningMinutes: timeSpentMinutes },
      update: { learningMinutes: { increment: timeSpentMinutes } },
    });

    await tx.activityLog.create({
      data: {
        userId,
        verb: 'LESSON_COMPLETE' as ActivityVerb,
        subject: lessonId,
        metadata: { courseId, xpAwarded },
      },
    });

    // Unlock next module when current module complete
    for (let i = 0; i < enrollment.course.modules.length; i++) {
      const mod = enrollment.course.modules[i];
      const modLessons = mod.lessons.map(l => l.id);
      const modComplete = modLessons.every(lid => {
        if (lid === lessonId) return true;
        return enrollment.lessonProgress.some(lp => lp.lessonId === lid && lp.completed);
      });
      if (modComplete && i + 1 < enrollment.course.modules.length) {
        await tx.courseModule.update({
          where: { id: enrollment.course.modules[i + 1].id },
          data: { locked: false },
        });
      }
    }
  });

  const allLessons = enrollment.course.modules.flatMap(m => m.lessons);
  const completedCount = await prisma.lessonProgress.count({
    where: { userCourseId: enrollment.id, completed: true },
  });

  if (completedCount >= allLessons.length) {
    await completeCourseForUser({ userId, courseId });
  }

  await cacheService.invalidateUser(userId);
  void inngest.send([{ name: 'app/recommendations.refresh', data: { userId } }]);
  void (async () => {
    const { recomputeWeeklyStudyHours } = await import('@/server/services/weekly-study-hours.service');
    await recomputeWeeklyStudyHours(userId);
  })();

  return { progressPct: Math.round((completedCount / allLessons.length) * 100), xpAwarded };
}

export async function completeCourseForUser(args: { userId: string; courseId: string }) {
  const { userId, courseId } = args;
  const today = isoDay.today();
  const actionKey = `course:${courseId}:${today}`;

  const existing = await prisma.gamificationEvent.findUnique({
    where: { userId_actionKey: { userId, actionKey } },
  });

  const enrollment = await prisma.userCourse.findUnique({
    where: { userId_courseId: { userId, courseId } },
    include: { course: true },
  });
  if (!enrollment || enrollment.status === 'COMPLETED') return;

  let bonusXp = 0;
  if (!existing) {
    bonusXp = Math.round(enrollment.course.totalXp * 0.2);
    await awardGamificationXp({
      userId,
      amount: bonusXp,
      actionKey: `course-complete:${courseId}`,
      actionType: 'COURSE_COMPLETE',
    });
  }

  await prisma.userCourse.update({
    where: { id: enrollment.id },
    data: {
      status: 'COMPLETED',
      completedAt: new Date(),
      progressPct: 100,
      xpEarned: { increment: bonusXp },
    },
  });

  await prisma.activityLog.create({
    data: {
      userId,
      verb: 'COURSE_COMPLETE' as ActivityVerb,
      subject: courseId,
      metadata: { bonusXp },
    },
  });

  await cacheService.invalidateUser(userId);
  void inngest.send([{ name: 'app/recommendations.refresh', data: { userId } }]);

  const { issueCourseCertificate } = await import('@/server/services/course-certificate.service');
  await issueCourseCertificate(userId, courseId);
}
