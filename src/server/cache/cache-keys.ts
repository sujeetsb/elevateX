/** Centralized cache key + tag helpers for invalidation. */
export const cacheKeys = {
  userProfile: (userId: string) => `v1:user:${userId}:profile`,
  userSkills: (userId: string) => `v1:user:${userId}:skills`,
  jobRecommendations: (userId: string) => `v1:user:${userId}:jobs:rec`,
  learningRecommendations: (userId: string) => `v1:user:${userId}:learn:rec`,
  resumeParse: (resumeId: string) => `v1:resume:${resumeId}:parse`,
  aiResponse: (hash: string) => `v1:ai:resp:${hash}`,
  profileAnalytics: (userId: string) => `v1:user:${userId}:analytics:profile`,
  tags: {
    user: (userId: string) => `tag:user:${userId}`,
    resume: (resumeId: string) => `tag:resume:${resumeId}`,
  },
} as const;
