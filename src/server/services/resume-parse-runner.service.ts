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
import { inngest } from '@/server/inngest/client';

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

    const normalized = normalizeGeminiResumeMerge(raw, rawText);
    logger.info('resume.parse phase', {
      resumeId,
      phase: 'normalize_complete',
      atsScore: normalized.atsScore,
      skillsCount: normalized.skills.length,
    });

    return normalized;
  } catch (e) {
    logger.warn('resume.parse gemini_error', { resumeId, error: String(e), phase: 'heuristic_fallback' });
    return buildFallbackResumeIntelligence(rawText);
  }
}

/** Run full resume parse pipeline (used by Inngest and inline fallback). */
export async function runResumeParse(resumeId: string): Promise<{ ok: boolean; atsScore?: number | null }> {
  await prisma.resume.updateMany({
    where: { id: resumeId, deletedAt: null },
    data: { parseStatus: 'PROCESSING', parseError: null },
  });

  const resume = await prisma.resume.findFirst({ where: { id: resumeId, deletedAt: null } });
  if (!resume?.rawText?.trim()) {
    await prisma.resume.updateMany({
      where: { id: resumeId, deletedAt: null },
      data: { parseStatus: 'FAILED', parseError: 'No resume text' },
    });
    return { ok: false };
  }

  try {
    const intelligence = await extractResumeIntelligence(resumeId, resume.rawText);
    await persistResumeIntelligence(resumeId, intelligence);

    const { generateUserInsights } = await import('@/server/services/user-insights.service');
    await generateUserInsights(resume.userId);

    try {
      await inngest.send({ name: 'app/recommendations.refresh', data: { userId: resume.userId } });
    } catch {
      // Non-fatal when Inngest unavailable
    }

    return { ok: true, atsScore: intelligence.atsScore };
  } catch (e) {
    await prisma.resume.updateMany({
      where: { id: resumeId, deletedAt: null },
      data: { parseStatus: 'FAILED', parseError: String(e instanceof Error ? e.message : e) },
    });
    logger.warn('resume.parse inline failed', { resumeId, error: String(e) });
    return { ok: false };
  }
}

/** True when parse should run in-process (dev default, or explicit env). */
export function shouldRunResumeParseInline(): boolean {
  if (process.env.RESUME_PARSE_INLINE === 'true') return true;
  if (process.env.RESUME_PARSE_INLINE === 'false') return false;
  return process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';
}

const inlineInFlight = new Set<string>();

/** Enqueue via Inngest when configured; otherwise run inline so ATS always generates. */
export async function enqueueResumeParse(resumeId: string): Promise<'inngest' | 'inline'> {
  if (shouldRunResumeParseInline()) {
    if (!inlineInFlight.has(resumeId)) {
      inlineInFlight.add(resumeId);
      void runResumeParse(resumeId).finally(() => inlineInFlight.delete(resumeId));
    }
    return 'inline';
  }

  try {
    await inngest.send({ name: 'app/resume.parse', data: { resumeId } });
    return 'inngest';
  } catch (e) {
    logger.warn('resume.parse inngest_send_failed', { resumeId, error: String(e) });
    if (!inlineInFlight.has(resumeId)) {
      inlineInFlight.add(resumeId);
      void runResumeParse(resumeId).finally(() => inlineInFlight.delete(resumeId));
    }
    return 'inline';
  }
}

/** Recover stuck PENDING resumes (e.g. Inngest worker never picked up the job). */
export async function kickStuckResumeParse(resumeId: string, createdAt: Date): Promise<boolean> {
  const ageMs = Date.now() - createdAt.getTime();
  if (ageMs < 12_000) return false;
  if (inlineInFlight.has(resumeId)) return false;

  inlineInFlight.add(resumeId);
  void runResumeParse(resumeId).finally(() => inlineInFlight.delete(resumeId));
  return true;
}
