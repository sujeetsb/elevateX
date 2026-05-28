import { prisma } from '@/server/db/prisma';
import { generateJsonText } from '@/server/ai/gemini';
import { interviewPrepSystem } from '@/server/ai/prompts/registry';
import { parseAiJson } from '@/lib/documents/parse-ai-output';
import type { InterviewPrepPayload, InterviewQuestion } from '@/lib/documents/interview-prep-types';

function asQuestions(raw: unknown, category?: InterviewQuestion['category']): InterviewQuestion[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map(item => {
      if (!item || typeof item !== 'object') return null;
      const o = item as Record<string, unknown>;
      const question = String(o.question ?? '').trim();
      if (!question) return null;
      return {
        question,
        hint: typeof o.hint === 'string' ? o.hint : undefined,
        category,
        difficulty: o.difficulty === 'easy' || o.difficulty === 'medium' || o.difficulty === 'hard'
          ? o.difficulty
          : undefined,
        answerGuide: typeof o.answerGuide === 'string' ? o.answerGuide : undefined,
        starFramework:
          o.starFramework && typeof o.starFramework === 'object'
            ? {
                situation: String((o.starFramework as Record<string, unknown>).situation ?? ''),
                task: String((o.starFramework as Record<string, unknown>).task ?? ''),
                action: String((o.starFramework as Record<string, unknown>).action ?? ''),
                result: String((o.starFramework as Record<string, unknown>).result ?? ''),
              }
            : undefined,
      } satisfies InterviewQuestion;
    })
    .filter(Boolean) as InterviewQuestion[];
}

function asStringList(raw: unknown, max = 8): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(x => String(x).trim()).filter(Boolean).slice(0, max);
}

function buildPayload(row: {
  id: string;
  jobId: string;
  jobTitle: string;
  company: string | null;
  content: unknown;
  createdAt: Date;
}): InterviewPrepPayload {
  const c = (row.content && typeof row.content === 'object' ? row.content : {}) as Record<string, unknown>;
  return {
    id: row.id,
    jobId: row.jobId,
    jobTitle: row.jobTitle,
    company: row.company ?? '',
    behavioralQuestions: asQuestions(c.behavioralQuestions, 'behavioral'),
    technicalQuestions: asQuestions(c.technicalQuestions, 'technical'),
    hrQuestions: asQuestions(c.hrQuestions, 'hr'),
    scenarioQuestions: asQuestions(c.scenarioQuestions, 'scenario'),
    companyQuestions: asQuestions(c.companyQuestions),
    preparationTips: asStringList(c.preparationTips, 8),
    importantSkills: asStringList(c.importantSkills, 10),
    expectedTopics: asStringList(c.expectedTopics, 10),
    salaryNegotiationTips: asStringList(c.salaryNegotiationTips, 6),
    keyStrengthsToHighlight: asStringList(c.keyStrengthsToHighlight, 8),
    createdAt: row.createdAt.toISOString(),
  };
}

export async function generateInterviewPrepForJob(input: {
  userId: string;
  jobId: string;
  jobTitle: string;
  company: string;
  jobDescription: string;
}): Promise<InterviewPrepPayload> {
  const [profile, user, skills, latestResume, insights] = await Promise.all([
    prisma.profile.findUnique({ where: { userId: input.userId } }),
    prisma.user.findUnique({
      where: { id: input.userId },
      select: { name: true, email: true },
    }),
    prisma.userSkill.findMany({
      where: { userId: input.userId },
      include: { skill: true },
      take: 20,
    }),
    prisma.resume.findFirst({
      where: { userId: input.userId, deletedAt: null, parseStatus: 'COMPLETE' },
      orderBy: { updatedAt: 'desc' },
      select: { parsedJson: true, rawText: true },
    }),
    prisma.userInsights.findUnique({ where: { userId: input.userId } }),
  ]);

  const skillLabels = skills.map(s => s.skill.label);
  const resumeSummary =
    latestResume?.rawText?.slice(0, 2500)
    ?? (latestResume?.parsedJson && typeof latestResume.parsedJson === 'object'
      ? JSON.stringify(latestResume.parsedJson).slice(0, 2500)
      : 'No resume on file');

  const targetRole = profile?.targetRole || input.jobTitle;

  const { text } = await generateJsonText({
    quality: 'balanced',
    system: interviewPrepSystem(),
    user: [
      `Candidate: ${user?.name || 'Applicant'}`,
      `Current role: ${profile?.currentRole || 'Not specified'}`,
      `Target role: ${targetRole}`,
      `Skills: ${skillLabels.join(', ') || 'See resume'}`,
      `Career goal: ${profile?.careerGoal || 'Career growth'}`,
      '',
      `Job: ${input.jobTitle} at ${input.company}`,
      `Description:\n${input.jobDescription}`,
      '',
      'Resume excerpt:',
      resumeSummary,
      '',
      insights?.skillsGap ? `Skills gap insights: ${JSON.stringify(insights.skillsGap).slice(0, 800)}` : '',
    ].join('\n'),
    maxOutputTokens: 4096,
  });

  const parsed = parseAiJson<Record<string, unknown>>(text);
  const content = {
    behavioralQuestions: parsed?.behavioralQuestions ?? [],
    technicalQuestions: parsed?.technicalQuestions ?? [],
    hrQuestions: parsed?.hrQuestions ?? [],
    scenarioQuestions: parsed?.scenarioQuestions ?? [],
    preparationTips: parsed?.preparationTips ?? [],
    importantSkills: parsed?.importantSkills ?? skillLabels.slice(0, 6),
    expectedTopics: parsed?.expectedTopics ?? [],
    companyQuestions: parsed?.companyQuestions ?? [],
    salaryNegotiationTips: parsed?.salaryNegotiationTips ?? [],
    keyStrengthsToHighlight: parsed?.keyStrengthsToHighlight ?? [],
  };

  const row = await prisma.jobInterviewPrep.upsert({
    where: { userId_jobId: { userId: input.userId, jobId: input.jobId } },
    create: {
      userId: input.userId,
      jobId: input.jobId,
      jobTitle: input.jobTitle,
      company: input.company,
      content,
    },
    update: {
      jobTitle: input.jobTitle,
      company: input.company,
      content,
    },
  });

  return buildPayload(row);
}

export async function getInterviewPrepForJob(
  userId: string,
  jobId: string,
): Promise<InterviewPrepPayload | null> {
  const row = await prisma.jobInterviewPrep.findUnique({
    where: { userId_jobId: { userId, jobId } },
  });
  if (!row) return null;
  return buildPayload(row);
}
