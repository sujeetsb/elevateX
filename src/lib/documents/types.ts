import type { ResumeDocument } from '@/lib/resume/types';

export type JobDocumentTemplate = 'modern' | 'minimal' | 'professional';

export type StructuredCoverLetter = {
  name: string;
  email: string;
  phone?: string;
  linkedIn?: string;
  date: string;
  company: string;
  jobTitle: string;
  body: string;
};

export type OptimizedResumePayload = {
  id: string;
  jobId: string;
  jobTitle: string;
  company?: string | null;
  template: JobDocumentTemplate;
  resumeVersion: number;
  document: ResumeDocument;
  missingKeywords: string[];
  atsImprovements: string[];
  suggestedChanges: string[];
  atsScoreBefore: number | null;
  atsScoreAfter: number | null;
  createdAt: string;
};

export type CoverLetterPayload = {
  id: string;
  jobId: string;
  letter: StructuredCoverLetter;
  createdAt: string;
};
