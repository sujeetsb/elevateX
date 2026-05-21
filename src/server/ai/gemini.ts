import { GoogleGenerativeAI } from '@google/generative-ai';
import { env } from '@/lib/server-env';
import { logger } from '@/server/logger';
import { serviceUnavailable } from '@/server/errors/http-error';
import { APP_NAME } from '@/lib/brand';

/**
 * Model tiers:
 * - flash:  Fast, cheap — mentor chat, quick classification, small JSON.
 * - pro:    High accuracy — resume intelligence, roadmap generation, ATS analysis.
 * - flash2: Gemini 2.0 Flash for best overall speed+quality balance (preferred when available).
 */
const MODEL_FLASH  = 'gemini-3.1-flash-lite';
const MODEL_PRO    = 'gemini-3-flash-preview';
const MODEL_FLASH2 = 'gemini-3.1-pro-preview'; 

/**
 * Choose model sequence based on task.
 * 'high' → try flash-2 first, fall back to pro then flash.
 * 'balanced' → flash-2 then flash.
 * 'fast' → flash only.
 */
function modelSequence(quality: 'high' | 'balanced' | 'fast'): string[] {
  if (quality === 'high')     return [MODEL_FLASH2, MODEL_PRO, MODEL_FLASH];
  if (quality === 'balanced') return [MODEL_FLASH2, MODEL_FLASH, MODEL_PRO];
  return [MODEL_FLASH];
}

async function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

/**
 * Generate structured JSON output from Gemini.
 * Uses responseMimeType: application/json to enforce JSON mode.
 */
export async function generateJsonText(options: {
  system: string;
  user: string;
  maxRetries?: number;
  maxOutputTokens?: number;
  /** 'high' for resume parse / roadmap, 'balanced' for onboarding, 'fast' for quick ops */
  quality?: 'high' | 'balanced' | 'fast';
  temperature?: number;
}): Promise<{ text: string; model: string }> {
  const key = env.GEMINI_API_KEY;
  if (!key) {
    const userPreview = options.user.trim().slice(0, 180).replace(/\s+/g, ' ');
    const text = [
      `Mock ${APP_NAME} mentor response (Gemini unavailable).`,
      '',
      '1) What I see:',
      `- Your message: "${userPreview}"`,
      '',
      '2) Next best actions:',
      '- Pick one skill-gap from your roadmap and complete one lesson today.',
      '- Save one job you want to target and review the missing skills list.',
      '- Send me a follow-up with your target role + the job you saved.',
      '',
      'If you want, share your ATS score (or upload a resume) and I will suggest a focused checklist.',
    ].join('\n');
    return { text, model: 'mock' };
  }

  const client = new GoogleGenerativeAI(key);
  const {
    system,
    user,
    maxRetries = 3,
    maxOutputTokens = 4096,
    quality = 'balanced',
    temperature = 0.15,
  } = options;
  const prompt = `${system}\n\n---\nUSER INPUT:\n${user}`;
  const models = modelSequence(quality);

  let lastErr: unknown;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    for (const modelName of models) {
      try {
        const model = client.getGenerativeModel({
          model: modelName,
          generationConfig: {
            temperature,
            maxOutputTokens,
            responseMimeType: 'application/json',
          },
        });
        const res = await model.generateContent(prompt);
        const text = res.response.text();
        if (text?.trim()) return { text: text.trim(), model: modelName };
      } catch (e) {
        lastErr = e;
        logger.warn('gemini.generateJson failed', { model: modelName, attempt, error: String(e) });
      }
    }
    if (attempt < maxRetries - 1) await sleep(300 * 2 ** attempt);
  }
  throw lastErr instanceof Error ? lastErr : new Error('Gemini JSON generation failed after retries');
}

/**
 * Generate plain text (for mentor chat, cover letters, etc.).
 * Returns markdown-formatted text suitable for display.
 */
export async function generateText(options: {
  system: string;
  user: string;
  maxRetries?: number;
  maxOutputTokens?: number;
  quality?: 'high' | 'balanced' | 'fast';
  temperature?: number;
}): Promise<{ text: string; model: string }> {
  const key = env.GEMINI_API_KEY;
  if (!key) throw serviceUnavailable('GEMINI_API_KEY not configured');

  const client = new GoogleGenerativeAI(key);
  const {
    system,
    user,
    maxRetries = 3,
    maxOutputTokens = 1024,
    quality = 'balanced',
    temperature = 0.4,
  } = options;
  const prompt = `${system}\n\n---\nUSER INPUT:\n${user}`;
  const models = modelSequence(quality);

  let lastErr: unknown;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    for (const modelName of models) {
      try {
        const model = client.getGenerativeModel({
          model: modelName,
          generationConfig: {
            temperature,
            maxOutputTokens,
            responseMimeType: 'text/plain',
          },
        });
        const res = await model.generateContent(prompt);
        const text = res.response.text();
        if (text?.trim()) return { text: text.trim(), model: modelName };
      } catch (e) {
        lastErr = e;
        logger.warn('gemini.generateText failed', { model: modelName, attempt, error: String(e) });
      }
    }
    if (attempt < maxRetries - 1) await sleep(300 * 2 ** attempt);
  }
  throw lastErr instanceof Error ? lastErr : new Error('Gemini text generation failed after retries');
}

/**
 * Specialized entry-point for full resume intelligence extraction.
 * Uses high-quality model with elevated token limit.
 */
export async function generateResumeIntelligence(options: {
  system: string;
  user: string;
}): Promise<{ text: string; model: string }> {
  return generateJsonText({
    ...options,
    quality: 'high',
    maxOutputTokens: 8192,
    maxRetries: 3,
    temperature: 0.1,
  });
}

/** Fallback when API fails — deterministic mock for dev continuity. */
export function mockResumeAnalyze(_user: string) {
  return {
    atsScore: 72,
    summary: 'Mock analysis: strengthen metrics and add missing toolchain keywords.',
    skills: ['TypeScript', 'React', 'Node.js'],
    gaps: ['Testing', 'System design'],
    bullets: ['Add quantified outcomes to each role.', 'Align summary with target title.'],
  };
}

/** Chunk very long resumes for model context windows. */
export function chunkText(text: string, maxChunk = 12_000): string[] {
  if (text.length <= maxChunk) return [text];
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += maxChunk) {
    chunks.push(text.slice(i, i + maxChunk));
  }
  return chunks;
}
