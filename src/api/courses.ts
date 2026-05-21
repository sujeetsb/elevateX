import { apiRequest } from './client';
import { isMockApiEnabled } from './config';

export type CourseGenerationPayload = {
  title: string;
  goals: string[];
  skillLevel: string;
  durationDays: number;
  learningStyle: string;
};

function delay(ms: number) {
  return new Promise<void>(resolve => setTimeout(resolve, ms));
}

/** Optional server-side validation / queue job before client-side generation UI. */
export async function submitCourseGenerationRequest(
  _payload: CourseGenerationPayload,
): Promise<{ accepted: boolean }> {
  if (isMockApiEnabled()) {
    await delay(200);
    return { accepted: true };
  }
  return apiRequest<{ accepted: boolean }>('/v1/courses/generate', {
    method: 'POST',
    body: JSON.stringify(_payload),
  });
}
