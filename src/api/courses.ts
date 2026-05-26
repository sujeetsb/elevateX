import { apiRequest } from './client';
import { isMockApiEnabled } from './config';
import type { Course } from '@/components/GameContext';

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

export type CourseGenerationResult = {
  accepted: boolean;
  cached?: boolean;
  course?: Course;
};

/** Generate AI course and persist to database. */
export async function submitCourseGenerationRequest(
  payload: CourseGenerationPayload,
): Promise<CourseGenerationResult> {
  if (isMockApiEnabled()) {
    await delay(200);
    return { accepted: true, cached: false };
  }
  return apiRequest<CourseGenerationResult>('/v1/courses/generate', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function fetchUserCourses() {
  return apiRequest<{
    all: Course[];
    continueLearning: Course[];
    completed: Course[];
    saved: Course[];
    active: Course[];
  }>('/v1/courses');
}

export async function fetchCourseById(id: string) {
  return apiRequest<Course>(`/v1/courses/${id}`);
}

export async function enrollInCourse(body: {
  courseId?: string;
  courseTitle?: string;
  resourceId?: string;
}) {
  return apiRequest<{ courseId: string; course: Course }>('/v1/courses/enroll', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function completeCourseLesson(body: {
  courseId: string;
  lessonId: string;
  quizScore?: number;
}) {
  return apiRequest<{ progressPct: number; xpAwarded: number; course: Course }>('/v1/courses/progress', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export type RecommendedCourse = {
  id: string;
  title: string;
  thumbnail: string;
  difficulty: string;
  days: number;
  xp: number;
  tags: string[];
  locked: boolean;
  courseId: string | null;
};

export async function fetchRecommendedCourses() {
  return apiRequest<RecommendedCourse[]>('/v1/courses?view=recommended');
}
