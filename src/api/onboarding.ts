import { apiRequest } from './client';
import { isMockApiEnabled } from './config';
import type { ResumeParseResult } from '@/types/resume-parse-result';

export type { ResumeParseResult };

function delay(ms: number) {
  return new Promise<void>(resolve => setTimeout(resolve, ms));
}

async function mockParseResumeFromFile(file: File): Promise<ResumeParseResult> {
  await delay(900 + Math.random() * 400);
  const base = file.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ');
  return {
    name: base.length > 2 ? base.replace(/\b\w/g, c => c.toUpperCase()) : 'Alex Chen',
    currentRole: 'Software Engineer',
    experience: '3 years',
    skills: ['TypeScript', 'React', 'Node.js', 'Git', 'REST APIs'],
    summary:
      'Experienced engineer with a focus on web platforms, APIs, and shipping reliable product features.',
  };
}

async function mockParseResumeFromText(text: string): Promise<ResumeParseResult> {
  await delay(600);
  const snippet = text.trim().slice(0, 80);
  return {
    name: 'Alex Chen',
    currentRole: 'Frontend Developer',
    experience: '3 years',
    skills: ['JavaScript', 'React', 'CSS'],
    summary: snippet ? `Profile summary (from paste): ${snippet}…` : 'Profile imported from pasted resume text.',
  };
}

/**
 * Parse resume file — mock locally, or upload with UploadThing first and POST JSON
 * `{ fileUrl, fileName, mimeType? }` to `/v1/onboarding/resume/parse` (non-mock).
 */
export async function parseResumeFile(file: File): Promise<ResumeParseResult> {
  if (isMockApiEnabled()) {
    return mockParseResumeFromFile(file);
  }
  throw new Error(
    'parseResumeFile: upload the file with UploadThing on the client, then POST { fileUrl, fileName } to /api/v1/onboarding/resume/parse.',
  );
}

export async function parseResumeText(text: string): Promise<ResumeParseResult> {
  if (isMockApiEnabled()) {
    return mockParseResumeFromText(text);
  }
  return apiRequest<ResumeParseResult>('/v1/onboarding/resume/parse-text', {
    method: 'POST',
    body: JSON.stringify({ text }),
  });
}
