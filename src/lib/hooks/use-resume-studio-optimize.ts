import { useMutation } from '@tanstack/react-query';
import { apiFetchJson } from '@/lib/api/client';
import type { OptimizeMode, ResumeDocument } from '@/lib/resume/types';

export type StudioOptimizeResponse = {
  document: ResumeDocument;
  atsScoreBefore: number | null;
  atsScoreAfter: number | null;
  mode: OptimizeMode;
  source: 'ai' | 'fallback';
};

export function useResumeStudioOptimizeMutation() {
  return useMutation({
    mutationFn: async (input: {
      resumeId: string;
      mode: OptimizeMode;
      document: ResumeDocument;
      targetRole?: string;
    }) =>
      apiFetchJson<StudioOptimizeResponse>(
        `/api/v1/resumes/${encodeURIComponent(input.resumeId)}/studio-optimize`,
        {
          method: 'POST',
          body: JSON.stringify({
            mode: input.mode,
            document: input.document,
            targetRole: input.targetRole,
          }),
        },
      ),
  });
}
