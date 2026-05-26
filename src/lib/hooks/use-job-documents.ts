import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CoverLetterPayload, OptimizedResumePayload } from '@/lib/documents/types';

export const jobDocumentKeys = {
  resume: (userId: string, jobId: string) => ['resume', userId, jobId] as const,
  coverLetter: (userId: string, jobId: string) => ['coverLetter', userId, jobId] as const,
  history: (userId: string) => ['jobDocuments', 'history', userId] as const,
};

async function fetchOptimizedResume(jobId: string): Promise<OptimizedResumePayload | null> {
  const res = await fetch(`/api/v1/jobs/optimize-resume?jobId=${encodeURIComponent(jobId)}`, {
    credentials: 'include',
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.message ?? 'Failed to load optimized resume');
  return json.data ?? null;
}

async function fetchCoverLetter(jobId: string): Promise<CoverLetterPayload | null> {
  const res = await fetch(`/api/v1/jobs/cover-letter?jobId=${encodeURIComponent(jobId)}`, {
    credentials: 'include',
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.message ?? 'Failed to load cover letter');
  return json.data ?? null;
}

export function useOptimizedResume(userId: string | undefined, jobId: string | null) {
  return useQuery({
    queryKey: jobDocumentKeys.resume(userId ?? '', jobId ?? ''),
    queryFn: () => fetchOptimizedResume(jobId!),
    enabled: Boolean(userId && jobId),
    staleTime: 60_000,
  });
}

export function useCoverLetter(userId: string | undefined, jobId: string | null) {
  return useQuery({
    queryKey: jobDocumentKeys.coverLetter(userId ?? '', jobId ?? ''),
    queryFn: () => fetchCoverLetter(jobId!),
    enabled: Boolean(userId && jobId),
    staleTime: 60_000,
  });
}

export function useOptimizeResumeMutation(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      jobId: string;
      jobTitle: string;
      company: string;
      jobDescription: string;
    }) => {
      const res = await fetch('/api/v1/jobs/optimize-resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(input),
      });
      const json = await res.json();
      if (!res.ok) {
        const err = new Error(json?.message ?? 'Optimization failed') as Error & { status?: number };
        err.status = res.status;
        throw err;
      }
      return json.data as OptimizedResumePayload;
    },
    onSuccess: (data, vars) => {
      if (!userId) return;
      qc.setQueryData(jobDocumentKeys.resume(userId, vars.jobId), data);
      void qc.invalidateQueries({ queryKey: jobDocumentKeys.history(userId) });
    },
  });
}

export function useGenerateCoverLetterMutation(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      jobId: string;
      jobTitle: string;
      company: string;
      jobDescription: string;
    }) => {
      const res = await fetch('/api/v1/jobs/cover-letter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(input),
      });
      const json = await res.json();
      if (!res.ok) {
        const err = new Error(json?.message ?? 'Cover letter generation failed') as Error & { status?: number };
        err.status = res.status;
        throw err;
      }
      return json.data as CoverLetterPayload;
    },
    onSuccess: (data, vars) => {
      if (!userId) return;
      qc.setQueryData(jobDocumentKeys.coverLetter(userId, vars.jobId), data);
      void qc.invalidateQueries({ queryKey: jobDocumentKeys.history(userId) });
    },
  });
}

export type JobDocumentHistoryRow = {
  jobId: string;
  jobTitle: string;
  company: string;
  optimizedResume: {
    id: string;
    template: string;
    resumeVersion: number;
    atsScoreBefore: number | null;
    atsScoreAfter: number | null;
    updatedAt: string;
  } | null;
  coverLetter: {
    id: string;
    updatedAt: string;
  } | null;
  application: {
    status: string;
    appliedAt: string | null;
  } | null;
};

export function useJobDocumentHistory(userId: string | undefined) {
  return useQuery({
    queryKey: jobDocumentKeys.history(userId ?? ''),
    queryFn: async () => {
      const res = await fetch('/api/v1/jobs/documents/history', { credentials: 'include' });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message ?? 'Failed to load document history');
      return (json.data ?? []) as JobDocumentHistoryRow[];
    },
    enabled: Boolean(userId),
    staleTime: 60_000,
  });
}
