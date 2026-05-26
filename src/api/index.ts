export { ApiError, isApiError, parseErrorResponse } from './errors';
export { getApiBaseUrl, isMockApiEnabled } from './config';
export { apiRequest } from './client';
export type { ApiRequestOptions } from './client';
export { parseResumeFile, parseResumeText } from './onboarding';
export type { ResumeParseResult } from './onboarding';
export { submitCourseGenerationRequest, fetchUserCourses, fetchCourseById, enrollInCourse, completeCourseLesson, fetchRecommendedCourses } from './courses';
export type { CourseGenerationPayload, CourseGenerationResult, RecommendedCourse } from './courses';
