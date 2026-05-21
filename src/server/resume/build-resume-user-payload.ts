import { chunkText } from '@/server/ai/gemini';

interface ResumeContext {
  targetRole?: string;
  experienceYears?: string | number | null;
  industry?: string | null;
  careerGoal?: string | null;
  currentRole?: string | null;
}

/**
 * Build a rich Gemini user message from raw resume text + optional profile context.
 * Context injection improves extraction accuracy and personalization.
 */
export function buildResumeUserPayload(rawText: string, ctx?: ResumeContext): string {
  const parts = chunkText(rawText, 14_000);

  const resumeBlock =
    parts.length === 1
      ? parts[0] ?? ''
      : parts.length === 2
        ? `RESUME (2 parts, same person):\n---\n${parts[0]}\n---\n${parts[1]}`
        : `RESUME (truncated; showing first 2 of ${parts.length} parts):\n---\n${parts[0]}\n---\n${parts[1]}`;

  if (!ctx) return resumeBlock;

  const contextLines: string[] = [];
  if (ctx.targetRole?.trim())      contextLines.push(`Target role: ${ctx.targetRole.trim()}`);
  if (ctx.currentRole?.trim())     contextLines.push(`Current role: ${ctx.currentRole.trim()}`);
  if (ctx.industry?.trim())        contextLines.push(`Industry: ${ctx.industry.trim()}`);
  if (ctx.careerGoal?.trim())      contextLines.push(`Career goal: ${ctx.careerGoal.trim()}`);
  if (ctx.experienceYears != null) contextLines.push(`Years experience: ${ctx.experienceYears}`);

  if (!contextLines.length) return resumeBlock;

  return `USER CONTEXT:\n${contextLines.join('\n')}\n\n${resumeBlock}`;
}
