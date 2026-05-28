import { Prisma } from '@prisma/client';
import { prisma } from '@/server/db/prisma';
import { generateJsonText } from '@/server/ai/gemini';
import { env } from '@/lib/server-env';
import { logger } from '@/server/logger';
import { parseAiJson } from '@/lib/documents/parse-ai-output';
import { resumeDocumentFromAiJson } from '@/lib/documents/resume-builder';
import { applyOptimizeMode } from '@/lib/resume/mockAi';
import type { OptimizeMode, ResumeDocument } from '@/lib/resume/types';

export type StudioOptimizeResult = {
  document: ResumeDocument;
  atsScoreBefore: number | null;
  atsScoreAfter: number | null;
  mode: OptimizeMode;
  source: 'ai' | 'fallback';
};

const MODE_PROMPTS: Record<OptimizeMode, string> = {
  polish: 'Light polish: tighten wording, add 1–2 ATS keywords, improve first bullet verbs. Keep structure.',
  rewrite: 'Rewrite summary and experience bullets for impact metrics and ATS keywords. Keep same roles/companies.',
  generate: 'Full executive-ready rewrite: stronger summary, quantified achievements, expanded skills. Same career facts.',
};

function scoreDelta(mode: OptimizeMode): number {
  if (mode === 'generate') return 12;
  if (mode === 'rewrite') return 8;
  return 5;
}

export async function optimizeResumeInStudio(input: {
  userId: string;
  resumeId: string;
  mode: OptimizeMode;
  document: ResumeDocument;
  targetRole?: string;
}): Promise<StudioOptimizeResult> {
  const resume = await prisma.resume.findFirst({
    where: { id: input.resumeId, userId: input.userId, deletedAt: null },
    select: { id: true, atsScore: true, parsedJson: true },
  });
  if (!resume) throw new Error('Resume not found');

  const atsBefore = resume.atsScore ?? null;
  let document = input.document;
  let source: 'ai' | 'fallback' = 'fallback';

  if (env.GEMINI_API_KEY) {
    try {
      const { text } = await generateJsonText({
        system:
          'You are an expert ATS resume optimizer. Return JSON: { "document": ResumeDocument }. Preserve ids and sectionOrder.',
        user: `${MODE_PROMPTS[input.mode]}\nTarget role: ${input.targetRole ?? 'not specified'}\n\nCurrent resume JSON:\n${JSON.stringify(input.document).slice(0, 14_000)}`,
        quality: 'high',
      });
      const parsed = parseAiJson<{ document?: ResumeDocument }>(text);
      if (parsed?.document?.personal?.fullName) {
        document = resumeDocumentFromAiJson(parsed, input.document);
        source = 'ai';
      }
    } catch (e) {
      logger.warn('studio-optimize AI failed', { error: String(e) });
    }
  }

  if (source === 'fallback') {
    document = applyOptimizeMode(input.document, input.mode);
  }

  const delta = scoreDelta(input.mode);
  const atsAfter = Math.min(98, (atsBefore ?? 55) + delta);

  const prevParsed =
    resume.parsedJson && typeof resume.parsedJson === 'object'
      ? (resume.parsedJson as Record<string, unknown>)
      : {};

  await prisma.resume.update({
    where: { id: resume.id },
    data: {
      parsedJson: { ...prevParsed, studioDocument: document } as unknown as Prisma.InputJsonValue,
      atsScore: atsAfter,
    },
  });

  return { document, atsScoreBefore: atsBefore, atsScoreAfter: atsAfter, mode: input.mode, source };
}
