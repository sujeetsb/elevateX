import { prisma } from '@/server/db/prisma';

const resumeSelect = {
  id: true,
  parseStatus: true,
  parseVersion: true,
  atsScore: true,
  confidence: true,
  lastParsedAt: true,
  updatedAt: true,
} as const;

export type LatestResumeForDisplay = {
  id: string;
  parseStatus: string;
  parseVersion: number;
  atsScore: number | null;
  confidence: unknown;
  lastParsedAt: Date | null;
  updatedAt: Date;
};

/**
 * Prefer a resume row that has an ATS score. Avoids hiding a completed score when a
 * newer upload is still PENDING (common after re-upload).
 */
export async function getLatestResumeForDisplay(userId: string): Promise<LatestResumeForDisplay | null> {
  const latest = await prisma.resume.findFirst({
    where: { userId, deletedAt: null },
    orderBy: { updatedAt: 'desc' },
    select: resumeSelect,
  });
  if (!latest) return null;
  if (latest.atsScore != null) return latest;

  const withScore = await prisma.resume.findFirst({
    where: { userId, deletedAt: null, parseStatus: 'COMPLETE', atsScore: { not: null } },
    orderBy: { updatedAt: 'desc' },
    select: resumeSelect,
  });

  return withScore ?? latest;
}

export async function getLatestAtsScore(userId: string): Promise<number | null> {
  const resume = await getLatestResumeForDisplay(userId);
  return resume?.atsScore ?? null;
}
