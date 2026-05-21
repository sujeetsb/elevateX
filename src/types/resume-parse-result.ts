/** Shared shape for onboarding UI + public parse API. */
export type ResumeParseResult = {
  name: string;
  currentRole: string;
  experience: string;
  skills: string[];
  summary: string;
  /** Full extracted text (when returned by server parse routes). */
  rawText?: string;
  email?: string;
  linkedIn?: string;
  targetRole?: string;
  careerGoal?: string;
  education?: string;
  certifications?: string[];
};
