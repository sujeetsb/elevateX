/** Central brand constants — single source of truth for ElevateX naming. */
export const APP_NAME = 'ElevateX';
export const APP_NAME_FULL = 'ElevateX — AI Career Guidance';
export const APP_TAGLINE = 'Accelerate your career with AI';
export const APP_AUTHOR = 'Sujeet Brahmankar';
export const COPYRIGHT_YEAR = 2026;
export const COPYRIGHT_NOTICE = `© ${COPYRIGHT_YEAR} ${APP_NAME} - ${APP_AUTHOR}. All rights reserved.`;
export const APP_DOMAIN = 'elevatex.io';
export const APP_URL = `https://${APP_DOMAIN}`;

export const STORAGE_KEYS = {
  theme: 'cp-theme',
  onboardingDraft: 'elevatex-onboarding-draft-v1',
  onboardingDraftLegacy: 'careerpilot-onboarding-draft-v1',
  resumeLibrary: 'elevatex-resume-library-v1',
  resumeLibraryLegacy: 'careerpilot-resume-library-v1',
  onboardingCache: (userId: string) => `ex_ob_v1_${userId}`,
  onboardingCacheLegacy: (userId: string) => `cp_ob_v1_${userId}`,
} as const;
