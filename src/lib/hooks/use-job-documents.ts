import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CoverLetterPayload, OptimizedResumePayload } from '@/lib/documents/types';
import type { InterviewPrepPayload } from '@/lib/documents/interview-prep-types';
import { apiFetchJson, ApiError } from '@/lib/api/client';

export const jobDocumentKeys = {
  resume: (userId: string, jobId: string) => ['resume', userId, jobId] as const,
  coverLetter: (userId: string, jobId: string) => ['coverLetter', userId, jobId] as const,
  interviewPrep: (userId: string, jobId: string) => ['interviewPrep', userId, jobId] as const,
  history: (userId: string) => ['jobDocuments', 'history', userId] as const,
};

async function fetchOptimizedResume(jobId: string): Promise<OptimizedResumePayload | null> {
  return apiFetchJson<OptimizedResumePayload | null>(
    `/api/v1/jobs/optimize-resume?jobId=${encodeURIComponent(jobId)}`,
  );
}

async function fetchCoverLetter(jobId: string): Promise<CoverLetterPayload | null> {
  return apiFetchJson<CoverLetterPayload | null>(
    `/api/v1/jobs/cover-letter?jobId=${encodeURIComponent(jobId)}`,
  );
}

export function useOptimizedResume(userId: string | undefined, jobId: string | null) {
  return useQuery({
    queryKey: jobDocumentKeys.resume(userId ?? '', jobId ?? ''),
    queryFn: () => fetchOptimizedResume(jobId!),
    enabled: Boolean(userId && jobId),
    staleTime: 5 * 60_000,
  });
}

export function useCoverLetter(userId: string | undefined, jobId: string | null) {
  return useQuery({
    queryKey: jobDocumentKeys.coverLetter(userId ?? '', jobId ?? ''),
    queryFn: () => fetchCoverLetter(jobId!),
    enabled: Boolean(userId && jobId),
    staleTime: 5 * 60_000,
  });
}

export function useOptimizeResumeMutation(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      jobId: string;
      jobTitle: string;
      company: string;
      jobDescription: string;
    }) =>
      apiFetchJson<OptimizedResumePayload>('/api/v1/jobs/optimize-resume', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
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

async function fetchInterviewPrep(jobId: string): Promise<InterviewPrepPayload | null> {
  const res = await fetch(`/api/v1/jobs/interview-prep?jobId=${encodeURIComponent(jobId)}`, {
    credentials: 'include',
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.message ?? 'Failed to load interview prep');
  return json.data ?? null;
}

export function useInterviewPrep(userId: string | undefined, jobId: string | null) {
  return useQuery({
    queryKey: jobDocumentKeys.interviewPrep(userId ?? '', jobId ?? ''),
    queryFn: () => fetchInterviewPrep(jobId!),
    enabled: Boolean(userId && jobId),
    staleTime: 5 * 60_000,
  });
}

export function useGenerateInterviewPrepMutation(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      jobId: string;
      jobTitle: string;
      company: string;
      jobDescription: string;
    }) => {
      const res = await fetch('/api/v1/jobs/interview-prep', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(input),
      });
      const json = await res.json();
      if (!res.ok) {
        const err = new Error(json?.message ?? 'Interview prep generation failed') as Error & {
          status?: number;
          code?: string;
          details?: unknown;
        };
        err.status = res.status;
        err.code = json?.code;
        err.details = json?.details;
        throw err;
      }
      return json.data as InterviewPrepPayload;
    },
    onSuccess: (data, vars) => {
      if (!userId) return;
      qc.setQueryData(jobDocumentKeys.interviewPrep(userId, vars.jobId), data);
    },
  });
}

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
    staleTime: 5 * 60_000,
  });
}
