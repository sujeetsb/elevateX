import { prisma } from '@/server/db/prisma';
import { generateJsonText } from '@/server/ai/gemini';
import { coverLetterSystem } from '@/server/ai/prompts/registry';
import { normalizeCoverLetterBody, parseAiJson } from '@/lib/documents/parse-ai-output';
import type { CoverLetterPayload, StructuredCoverLetter } from '@/lib/documents/types';

export function buildStructuredCoverLetter(parts: {
  name: string;
  email: string;
  phone?: string;
  linkedIn?: string;
  company: string;
  jobTitle: string;
  body: string;
}): StructuredCoverLetter {
  return {
    name: parts.name || 'Applicant',
    email: parts.email || '',
    phone: parts.phone,
    linkedIn: parts.linkedIn,
    date: new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }),
    company: parts.company,
    jobTitle: parts.jobTitle,
    body: parts.body.trim(),
  };
}

export async function generateCoverLetterForJob(input: {
  userId: string;
  jobId: string;
  jobTitle: string;
  company: string;
  jobDescription: string;
}): Promise<CoverLetterPayload> {
  const [profile, user, skills] = await Promise.all([
    prisma.profile.findUnique({ where: { userId: input.userId } }),
    prisma.user.findUnique({
      where: { id: input.userId },
      select: { name: true, email: true },
    }),
    prisma.userSkill.findMany({
      where: { userId: input.userId },
      include: { skill: true },
      take: 16,
    }),
  ]);

  const { text } = await generateJsonText({
    quality: 'fast',
    system: coverLetterSystem(),
    user: [
      `Candidate: ${user?.name || 'Applicant'}`,
      `Email: ${user?.email || ''}`,
      `Current role: ${profile?.currentRole || 'Not specified'}`,
      `Target role: ${profile?.targetRole || input.jobTitle}`,
      `Skills: ${skills.map(s => s.skill.label).join(', ') || 'See resume'}`,
      `Career goal: ${profile?.careerGoal || 'Career growth'}`,
      '',
      `Job: ${input.jobTitle} at ${input.company}`,
      `Description:\n${input.jobDescription}`,
      '',
      'Write a professional cover letter (3-4 paragraphs). Return JSON: { "coverLetter": "..." }',
    ].join('\n'),
    maxOutputTokens: 1200,
  });

  const parsed = parseAiJson<{ coverLetter?: string }>(text);
  const body = normalizeCoverLetterBody(
    typeof parsed?.coverLetter === 'string' ? parsed.coverLetter : text,
  );

  const letter = buildStructuredCoverLetter({
    name: user?.name || 'Applicant',
    email: user?.email || '',
    linkedIn: profile?.linkedInUrl ?? undefined,
    company: input.company,
    jobTitle: input.jobTitle,
    body,
  });

  const row = await prisma.generatedCoverLetter.upsert({
    where: { userId_jobId: { userId: input.userId, jobId: input.jobId } },
    create: {
      userId: input.userId,
      jobId: input.jobId,
      content: letter,
    },
    update: {
      content: letter,
    },
  });

  return {
    id: row.id,
    jobId: row.jobId,
    letter,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function getCoverLetterForJob(userId: string, jobId: string): Promise<CoverLetterPayload | null> {
  const row = await prisma.generatedCoverLetter.findUnique({
    where: { userId_jobId: { userId, jobId } },
  });
  if (!row) return null;
  const letter = row.content as StructuredCoverLetter;
  return {
    id: row.id,
    jobId: row.jobId,
    letter,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listJobDocumentHistory(userId: string, limit = 30) {
  const [resumes, letters, applications] = await Promise.all([
    prisma.optimizedResume.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      take: limit,
      include: { job: { select: { title: true, company: true } } },
    }),
    prisma.generatedCoverLetter.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      take: limit,
      include: { job: { select: { title: true, company: true } } },
    }),
    prisma.jobApplication.findMany({
      where: { userId },
      select: { jobId: true, status: true, appliedAt: true },
    }),
  ]);

  const byJob = new Map<
    string,
    {
      jobId: string;
      jobTitle: string;
      company: string;
      optimizedResume: (typeof resumes)[0] | null;
      coverLetter: (typeof letters)[0] | null;
      application: (typeof applications)[0] | null;
    }
  >();

  for (const r of resumes) {
    const existing = byJob.get(r.jobId) ?? {
      jobId: r.jobId,
      jobTitle: r.jobTitle || r.job?.title || 'Role',
      company: r.company || r.job?.company || '',
      optimizedResume: null,
      coverLetter: null,
      application: null,
    };
    existing.optimizedResume = r;
    byJob.set(r.jobId, existing);
  }

  for (const c of letters) {
    const letter = c.content as StructuredCoverLetter;
    const existing = byJob.get(c.jobId) ?? {
      jobId: c.jobId,
      jobTitle: letter.jobTitle || c.job?.title || 'Role',
      company: letter.company || c.job?.company || '',
      optimizedResume: null,
      coverLetter: null,
      application: null,
    };
    existing.coverLetter = c;
    byJob.set(c.jobId, existing);
  }

  for (const a of applications) {
    const existing = byJob.get(a.jobId);
    if (existing) existing.application = a;
  }

  return Array.from(byJob.values()).sort((a, b) => {
    const aTime = a.optimizedResume?.updatedAt ?? a.coverLetter?.updatedAt ?? new Date(0);
    const bTime = b.optimizedResume?.updatedAt ?? b.coverLetter?.updatedAt ?? new Date(0);
    return bTime.getTime() - aTime.getTime();
  });
}
