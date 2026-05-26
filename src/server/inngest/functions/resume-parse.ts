import { inngest } from '../client';
import { prisma } from '@/server/db/prisma';
import { buildResumeParsePrimarySystem } from '@/server/ai/prompts/ai-agent-sample-prompts';
import { generateResumeIntelligence } from '@/server/ai/gemini';
import { buildResumeUserPayload } from '@/server/resume/build-resume-user-payload';
import { env } from '@/lib/server-env';
import { logger } from '@/server/logger';
import { persistResumeIntelligence } from '@/server/services/resume-parse-persist.service';
import { buildFallbackResumeIntelligence } from '@/server/services/resume-intelligence-fallback';
import { normalizeGeminiResumeMerge } from '@/server/services/resume-intelligence-normalize.service';
import type { ResumeIntelligence } from '@/server/ai/schemas';

function parseJsonSafe(text: string, resumeId: string): unknown | null {
  try {
    return JSON.parse(text) as unknown;
  } catch (e) {
    logger.warn('resume.parse malformed_json', { resumeId, error: String(e) });
    return null;
  }
}

async function extractResumeIntelligence(resumeId: string, rawText: string): Promise<ResumeIntelligence> {
  const body = buildResumeUserPayload(rawText);

  if (!env.GEMINI_API_KEY) {
    logger.warn('resume.parse no_gemini_key', { resumeId, phase: 'heuristic_fallback' });
    return buildFallbackResumeIntelligence(rawText);
  }

  logger.info('resume.parse phase', { resumeId, phase: 'gemini_request' });

  try {
    const { text, model } = await generateResumeIntelligence({
      system: buildResumeParsePrimarySystem(),
      user: body.slice(0, 48_000),
    });

    logger.info('resume.parse phase', { resumeId, phase: 'gemini_response', model });

    const raw = parseJsonSafe(text, resumeId);
    if (raw == null) {
      return buildFallbackResumeIntelligence(rawText);
    }

    logger.info('resume.parse phase', { resumeId, phase: 'normalize' });
    const normalized = normalizeGeminiResumeMerge(raw, rawText);

    logger.info('resume.parse phase', {
      resumeId,
      phase: 'normalize_complete',
      atsScore: normalized.atsScore,
      skillsCount: normalized.skills.length,
      hasAnalyzerReport: Boolean(normalized.analyzerReport),
    });

    return normalized;
  } catch (e) {
    logger.warn('resume.parse gemini_error', { resumeId, error: String(e), phase: 'heuristic_fallback' });
    return buildFallbackResumeIntelligence(rawText);
  }
}

export const resumeParseFn = inngest.createFunction(
  {
    id: 'resume-parse',
    name: 'Resume / Parse',
    retries: 3,
    onFailure: async ({ event, error }) => {
      const resumeId = (event.data.event?.data as { resumeId?: string } | undefined)?.resumeId;
      if (!resumeId) return;
      await prisma.resume.updateMany({
        where: { id: resumeId, deletedAt: null },
        data: { parseStatus: 'FAILED', parseError: String(error?.message ?? 'Resume parse failed') },
      });
      logger.warn('resume.parse failed', { resumeId, error: String(error?.message) });
    },
  },
  { event: 'app/resume.parse' },
  async ({ event, step }) => {
    const resumeId = event.data.resumeId as string;

    await step.run('mark-processing', () =>
      prisma.resume.updateMany({
        where: { id: resumeId, deletedAt: null },
        data: { parseStatus: 'PROCESSING', parseError: null },
      }),
    );

    const resume = await step.run('load', () =>
      prisma.resume.findFirst({ where: { id: resumeId, deletedAt: null } }),
    );

    if (!resume?.rawText?.trim()) {
      await prisma.resume.updateMany({
        where: { id: resumeId, deletedAt: null },
        data: { parseStatus: 'FAILED', parseError: 'No resume text' },
      });
      logger.warn('resume.parse aborted', { resumeId, reason: 'no_text' });
      return { ok: false };
    }

    const intelligence = await step.run('analyze', () =>
      extractResumeIntelligence(resumeId, resume.rawText!),
    );

    await step.run('persist', async () => {
      logger.info('resume.parse phase', { resumeId, phase: 'persist_start' });
      await persistResumeIntelligence(resumeId, intelligence);
      logger.info('resume.parse phase', { resumeId, phase: 'persist_complete' });
    });

    await step.run('generate-insights', async () => {
      const { generateUserInsights } = await import('@/server/services/user-insights.service');
      await generateUserInsights(resume.userId);
    });

    await step.run('enqueue-followups', () =>
      inngest.send([{ name: 'app/recommendations.refresh', data: { userId: resume.userId } }]),
    );

    return { ok: true, resumeId };
  },
);
