import { prisma } from '@/server/db/prisma';
import { generateJsonText } from '@/server/ai/gemini';
import { env } from '@/lib/server-env';
import { logger } from '@/server/logger';
import { parseAiJson } from '@/lib/documents/parse-ai-output';
import {
  buildResumeDocumentFromParts,
  resumeDocumentFromAiJson,
  DEFAULT_JOB_RESUME_TEMPLATE,
} from '@/lib/documents/resume-builder';
import type { OptimizedResumePayload, JobDocumentTemplate } from '@/lib/documents/types';
import type { ResumeDocument } from '@/lib/resume/types';

export type OptimizedResumeResult = {
  template: JobDocumentTemplate;
  resumeVersion: number;
  document: ResumeDocument;
  optimizedText: string;
  missingKeywords: string[];
  atsImprovements: string[];
  suggestedChanges: string[];
  atsScoreBefore: number | null;
  atsScoreAfter: number | null;
};

function baseDocumentFromProfile(input: {
  userName?: string | null;
  userEmail?: string | null;
  profile: { currentRole?: string | null; targetRole?: string | null; linkedInUrl?: string | null } | null;
  skillLabels: string[];
  resumeParsed?: unknown;
}): ResumeDocument {
  if (input.resumeParsed && typeof input.resumeParsed === 'object') {
    const fromAi = resumeDocumentFromAiJson({ document: input.resumeParsed }, buildResumeDocumentFromParts({
      fullName: input.userName ?? 'Applicant',
      email: input.userEmail ?? '',
      linkedIn: input.profile?.linkedInUrl ?? undefined,
      headline: input.profile?.currentRole ?? undefined,
      summary: '',
      skills: input.skillLabels,
    }));
    if (fromAi.personal.fullName) return fromAi;
  }

  return buildResumeDocumentFromParts({
    fullName: input.userName ?? 'Applicant',
    email: input.userEmail ?? '',
    linkedIn: input.profile?.linkedInUrl ?? undefined,
    headline: input.profile?.currentRole ?? undefined,
    summary: input.profile?.targetRole
      ? `Experienced professional targeting ${input.profile.targetRole} roles.`
      : '',
    skills: input.skillLabels,
  });
}

function documentToPlainText(doc: ResumeDocument): string {
  const lines: string[] = [
    doc.personal.fullName,
    [doc.personal.email, doc.personal.phone, doc.personal.location].filter(Boolean).join(' · '),
    '',
    doc.summary,
    '',
    ...doc.experience.flatMap(e => [
      `${e.role} — ${e.company}`,
      `${e.start} – ${e.end}`,
      ...e.bullets.map(b => `• ${b}`),
      '',
    ]),
    doc.skills.length ? `Skills: ${doc.skills.join(', ')}` : '',
  ];
  return lines.filter(Boolean).join('\n');
}

export async function optimizeResumeForJob(input: {
  userId: string;
  jobId: string;
  jobTitle: string;
  company?: string;
  jobDescription: string;
}): Promise<{ id: string; result: OptimizedResumeResult }> {
  const [profile, skills, resume, user, existing] = await Promise.all([
    prisma.profile.findUnique({ where: { userId: input.userId } }),
    prisma.userSkill.findMany({ where: { userId: input.userId }, include: { skill: true }, take: 20 }),
    prisma.resume.findFirst({
      where: { userId: input.userId, deletedAt: null, parseStatus: 'COMPLETE' },
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.user.findUnique({ where: { id: input.userId }, select: { name: true, email: true } }),
    prisma.optimizedResume.findUnique({
      where: { userId_jobId: { userId: input.userId, jobId: input.jobId } },
    }),
  ]);

  const resumeText =
    resume?.rawText?.slice(0, 12_000) ??
    (resume?.parsedJson ? JSON.stringify(resume.parsedJson).slice(0, 8000) : '');
  const skillLabels = skills.map(s => s.skill.label);
  const atsBefore = resume?.atsScore ?? null;
  const fallbackDoc = baseDocumentFromProfile({
    userName: user?.name,
    userEmail: user?.email,
    profile,
    skillLabels,
    resumeParsed: resume?.parsedJson,
  });

  let result: OptimizedResumeResult = {
    template: DEFAULT_JOB_RESUME_TEMPLATE,
    resumeVersion: (existing?.resumeVersion ?? 0) + 1,
    document: fallbackDoc,
    optimizedText: resumeText || 'No resume on file. Upload a resume in ATS Optimizer first.',
    missingKeywords: [],
    atsImprovements: ['Add role-specific keywords from the job description.'],
    suggestedChanges: ['Tailor summary to match the target role.'],
    atsScoreBefore: atsBefore,
    atsScoreAfter: atsBefore != null ? Math.min(99, atsBefore + 8) : null,
  };

  if (env.GEMINI_API_KEY && resumeText.length > 40) {
    try {
      const { text } = await generateJsonText({
        quality: 'balanced',
        system: 'You are an expert resume writer and ATS optimizer. Respond with valid JSON only.',
        user: [
          `Job title: ${input.jobTitle}`,
          `Company: ${input.company ?? 'Unknown'}`,
          `Job description:\n${input.jobDescription.slice(0, 6000)}`,
          '',
          `Candidate: ${user?.name ?? 'Applicant'}`,
          `Email: ${user?.email ?? ''}`,
          `Current role: ${profile?.currentRole ?? ''}`,
          `Target role: ${profile?.targetRole ?? input.jobTitle}`,
          `Skills: ${skillLabels.join(', ')}`,
          `Current ATS score: ${atsBefore ?? 'unknown'}`,
          '',
          'Resume text:',
          resumeText.slice(0, 8000),
          '',
          'Return JSON with a structured resume document:',
          '{',
          '  "document": {',
          '    "personal": { "fullName": "", "email": "", "phone": "", "location": "", "headline": "" },',
          '    "summary": "...",',
          '    "skills": ["..."],',
          '    "experience": [{ "role": "", "company": "", "start": "", "end": "", "bullets": ["..."] }],',
          '    "education": [{ "school": "", "degree": "", "start": "", "end": "" }]',
          '  },',
          '  "optimizedText": "optional plain text fallback",',
          '  "missingKeywords": ["keyword1"],',
          '  "atsImprovements": ["improvement1"],',
          '  "suggestedChanges": ["change1"],',
          '  "atsScoreAfter": 88',
          '}',
        ].join('\n'),
        maxOutputTokens: 4096,
      });

      const parsed = parseAiJson<Partial<OptimizedResumeResult & { document?: ResumeDocument }>>(text);
      if (parsed) {
        const document = resumeDocumentFromAiJson(parsed, fallbackDoc);
        result = {
          template: DEFAULT_JOB_RESUME_TEMPLATE,
          resumeVersion: (existing?.resumeVersion ?? 0) + 1,
          document,
          optimizedText: String(parsed.optimizedText ?? documentToPlainText(document)),
          missingKeywords: Array.isArray(parsed.missingKeywords) ? parsed.missingKeywords.map(String) : [],
          atsImprovements: Array.isArray(parsed.atsImprovements)
            ? parsed.atsImprovements.map(String)
            : result.atsImprovements,
          suggestedChanges: Array.isArray(parsed.suggestedChanges)
            ? parsed.suggestedChanges.map(String)
            : result.suggestedChanges,
          atsScoreBefore: atsBefore,
          atsScoreAfter: typeof parsed.atsScoreAfter === 'number' ? parsed.atsScoreAfter : result.atsScoreAfter,
        };
      }
    } catch (e) {
      logger.warn('optimize-resume AI failed', { error: String(e) });
    }
  }

  const row = await prisma.optimizedResume.upsert({
    where: { userId_jobId: { userId: input.userId, jobId: input.jobId } },
    create: {
      userId: input.userId,
      jobId: input.jobId,
      jobTitle: input.jobTitle,
      company: input.company ?? null,
      sourceResumeId: resume?.id ?? null,
      template: result.template,
      resumeVersion: result.resumeVersion,
      content: result.document as object,
      optimizedText: result.optimizedText,
      missingKeywords: result.missingKeywords,
      atsImprovements: result.atsImprovements,
      suggestedChanges: result.suggestedChanges,
      atsScoreBefore: result.atsScoreBefore,
      atsScoreAfter: result.atsScoreAfter,
    },
    update: {
      jobTitle: input.jobTitle,
      company: input.company ?? null,
      sourceResumeId: resume?.id ?? null,
      template: result.template,
      resumeVersion: result.resumeVersion,
      content: result.document as object,
      optimizedText: result.optimizedText,
      missingKeywords: result.missingKeywords,
      atsImprovements: result.atsImprovements,
      suggestedChanges: result.suggestedChanges,
      atsScoreBefore: result.atsScoreBefore,
      atsScoreAfter: result.atsScoreAfter,
    },
  });

  return { id: row.id, result };
}

export function rowToOptimizedPayload(row: {
  id: string;
  jobId: string;
  jobTitle: string;
  company: string | null;
  template: string;
  resumeVersion: number;
  content: unknown;
  missingKeywords: unknown;
  atsImprovements: unknown;
  suggestedChanges: unknown;
  atsScoreBefore: number | null;
  atsScoreAfter: number | null;
  createdAt: Date;
}): OptimizedResumePayload {
  return {
    id: row.id,
    jobId: row.jobId,
    jobTitle: row.jobTitle,
    company: row.company,
    template: (row.template as JobDocumentTemplate) || DEFAULT_JOB_RESUME_TEMPLATE,
    resumeVersion: row.resumeVersion,
    document: row.content as ResumeDocument,
    missingKeywords: Array.isArray(row.missingKeywords) ? row.missingKeywords.map(String) : [],
    atsImprovements: Array.isArray(row.atsImprovements) ? row.atsImprovements.map(String) : [],
    suggestedChanges: Array.isArray(row.suggestedChanges) ? row.suggestedChanges.map(String) : [],
    atsScoreBefore: row.atsScoreBefore,
    atsScoreAfter: row.atsScoreAfter,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function getOptimizedResumeForJob(userId: string, jobId: string): Promise<OptimizedResumePayload | null> {
  const row = await prisma.optimizedResume.findUnique({
    where: { userId_jobId: { userId, jobId } },
  });
  if (!row) return null;
  return rowToOptimizedPayload(row);
}

export async function listOptimizedResumes(userId: string, limit = 20) {
  return prisma.optimizedResume.findMany({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
    take: limit,
    select: {
      id: true,
      jobId: true,
      jobTitle: true,
      company: true,
      template: true,
      resumeVersion: true,
      atsScoreBefore: true,
      atsScoreAfter: true,
      missingKeywords: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

export async function getOptimizedResume(userId: string, id: string) {
  const row = await prisma.optimizedResume.findFirst({ where: { userId, id } });
  if (!row) return null;
  return rowToOptimizedPayload(row);
}
