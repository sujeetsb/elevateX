import { resumeIntelligenceSchema, type ResumeIntelligence } from '@/server/ai/schemas';
import { heuristicResumeParse } from '@/server/resume/heuristic-parse';
import { sanitizeTargetRolesSuggested } from '@/server/services/resume-post-process';

const emptyExtended = {
  headline: null as string | null,
  careerObjective: null as string | null,
  technicalSkills: [] as string[],
  tools: [] as string[],
  platforms: [] as string[],
  languages: [] as string[],
  strengths: [] as string[],
  industriesSuggested: [] as string[],
  careerLevel: null as string | null,
  awards: [] as string[],
  publications: [] as string[],
  volunteering: [] as string[],
  leadership: [] as string[],
  interests: [] as string[],
  extracurricularActivities: [] as string[],
};

export function buildFallbackResumeIntelligence(rawText: string): ResumeIntelligence {
  const q = heuristicResumeParse(rawText);
  const years = parseInt(String(q.experience).replace(/\D/g, ''), 10);
  const base = resumeIntelligenceSchema.parse({
    personal: { fullName: q.name },
    summary: q.summary,
    ...emptyExtended,
    skills: q.skills,
    gaps: ['Quantified impact', 'Role-specific keywords', 'Leadership scope'],
    experience: [],
    education: [],
    certifications: [],
    projects: [],
    softSkills: ['Communication', 'Collaboration'],
    domainExpertise: [],
    targetRolesSuggested: [q.currentRole],
    yearsOfExperienceApprox: Number.isFinite(years) ? years : null,
    atsScore: 66,
    confidence: { overall: 0.35 },
  });
  return {
    ...base,
    targetRolesSuggested: sanitizeTargetRolesSuggested(base.targetRolesSuggested, rawText, base),
  };
}
