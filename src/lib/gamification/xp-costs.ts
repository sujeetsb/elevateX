/** XP costs for AI-powered features. PRO tier unlocks access; XP is consumed on use. */
export const XP_COSTS = {
  RESUME_OPTIMIZE: 50,
  COVER_LETTER: 40,
  INTERVIEW_PREP: 60,
  SALARY_INSIGHTS: 30,
  AI_MENTOR: 15,
} as const;

export type XpFeatureKey = keyof typeof XP_COSTS;

export const XP_EARN_SUGGESTIONS = [
  'Complete a course lesson (+80 XP)',
  'Claim your daily streak bonus (+25 XP)',
  'Finish onboarding profile sections (+500 XP)',
  'Apply to a matched job (+50–120 XP)',
  'Pass a quiz with a high score (+bonus XP)',
];

export function getXpCost(feature: XpFeatureKey): number {
  return XP_COSTS[feature];
}
