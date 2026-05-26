import { createHash } from 'node:crypto';
import { prisma } from '@/server/db/prisma';

function makeCertificateId(userId: string, courseId: string): string {
  const hash = createHash('sha256').update(`${userId}:${courseId}`, 'utf8').digest('hex').slice(0, 8).toUpperCase();
  return `CP-${hash}`;
}

export async function issueCourseCertificate(userId: string, courseId: string) {
  const existing = await prisma.courseCertificate.findUnique({
    where: { userId_courseId: { userId, courseId } },
  });
  if (existing) return existing;

  const enrollment = await prisma.userCourse.findUnique({
    where: { userId_courseId: { userId, courseId } },
    include: {
      course: true,
      user: { select: { name: true } },
    },
  });
  if (!enrollment || enrollment.status !== 'COMPLETED') return null;

  return prisma.courseCertificate.create({
    data: {
      userId,
      courseId,
      userCourseId: enrollment.id,
      certificateId: makeCertificateId(userId, courseId),
      userName: enrollment.user.name ?? 'Learner',
      courseTitle: enrollment.course.title,
      completedAt: enrollment.completedAt ?? new Date(),
      xpEarned: enrollment.xpEarned,
    },
  });
}

export async function listUserCourseCertificates(userId: string) {
  return prisma.courseCertificate.findMany({
    where: { userId },
    orderBy: { completedAt: 'desc' },
    include: { course: { select: { title: true, difficulty: true, totalXp: true } } },
  });
}

export async function getCourseCertificate(userId: string, certificateId: string) {
  return prisma.courseCertificate.findFirst({
    where: {
      userId,
      OR: [{ id: certificateId }, { certificateId }],
    },
    include: { course: true },
  });
}
