import type { ResumeIntelligence } from '@/server/ai/schemas';

const GENERIC_TECH_ROLES = new Set([
  'engineering',
  'engineer',
  'software',
  'developer',
  'development',
  'programming',
  'coder',
  'coding',
  'devops',
  'swe',
]);

const TECH_SIGNAL =
  /\b(javascript|typescript|python|java\b|react|angular|vue|node\.?js|kubernetes|docker|aws|gcp|azure|sql|c\+\+|c#|\.net|ruby|rails|php|laravel|scala|go\b|rust|swift|kotlin|flutter|android|ios|frontend|backend|full[\s-]?stack|software|devops|ml\b|machine learning|data engineer|platform engineer|site reliability|sre)\b/i;

function textBlob(intel: Pick<ResumeIntelligence, 'skills' | 'experience' | 'summary' | 'technicalSkills'>, resumeText: string): string {
  const parts = [
    resumeText,
    intel.summary ?? '',
    ...(intel.skills ?? []),
    ...(intel.technicalSkills ?? []),
    ...(intel.experience ?? []).map(
      e =>
        `${e.title ?? ''} ${e.company ?? ''} ${(e.bullets ?? []).join(' ')} ${(e as { responsibilities?: string[] }).responsibilities?.join?.(' ') ?? ''}`,
    ),
  ];
  return parts.join('\n');
}

export function detectTechnicalCandidate(
  resumeText: string,
  intel: Pick<
    ResumeIntelligence,
    'skills' | 'experience' | 'summary' | 'technicalSkills' | 'tools' | 'platforms' | 'languages'
  >,
): boolean {
  const blob = textBlob(intel, resumeText);
  if (TECH_SIGNAL.test(blob)) return true;
  const tools = [...(intel.tools ?? []), ...(intel.platforms ?? []), ...(intel.languages ?? [])].join(' ');
  if (TECH_SIGNAL.test(tools)) return true;
  return false;
}

/** Strip generic tech titles for non-technical resumes; prefer real job titles. */
export function sanitizeTargetRolesSuggested(
  roles: string[],
  resumeText: string,
  intel: Pick<
    ResumeIntelligence,
    'skills' | 'experience' | 'summary' | 'technicalSkills' | 'tools' | 'platforms' | 'languages' | 'headline'
  >,
): string[] {
  const cleaned = [...new Set(roles.map(r => r.trim()).filter(Boolean))];
  if (!cleaned.length) return [];
  const technical = detectTechnicalCandidate(resumeText, intel);
  if (technical) return cleaned.slice(0, 12);

  const firstExp = intel.experience?.[0];
  const expTitle =
    (firstExp?.title && String(firstExp.title).trim()) ||
    (intel.headline && String(intel.headline).trim()) ||
    '';

  const isGeneric = (r: string) => {
    const x = r.toLowerCase();
    if (GENERIC_TECH_ROLES.has(x)) return true;
    if (x === 'engineering' || x === 'engineer') return true;
    if (/^software\b/i.test(r) && !TECH_SIGNAL.test(r)) return true;
    return false;
  };

  const filtered = cleaned.filter(r => !isGeneric(r));
  if (filtered.length) return filtered.slice(0, 12);

  if (expTitle && !isGeneric(expTitle)) return [expTitle.slice(0, 120)];

  const fromSummary = (intel.summary ?? '').split(/[.•\n]/)[0]?.trim();
  if (fromSummary && fromSummary.length > 3 && fromSummary.length < 120 && !isGeneric(fromSummary)) {
    return [fromSummary];
  }

  return ['Professional'];
}

/** Derive overall confidence from extraction completeness (0–1). */
export function computeExtractionConfidence(intel: ResumeIntelligence): number {
  let score = 0;
  let max = 0;
  const bump = (ok: boolean, w: number) => {
    max += w;
    if (ok) score += w;
  };

  bump(!!intel.personal?.fullName?.trim(), 10);
  bump(!!intel.personal?.email?.trim(), 5);
  bump(!!intel.personal?.phone?.trim(), 3);
  bump((intel.summary ?? '').trim().length > 24, 12);
  bump((intel.headline ?? '').trim().length > 3, 5);
  bump(intel.experience.length > 0, 18);
  bump(intel.education.length > 0, 10);
  bump(intel.skills.length >= 4, 12);
  bump(intel.projects.length > 0, 6);
  bump(intel.certifications.length > 0, 5);
  bump(intel.targetRolesSuggested.length > 0, 8);
  bump(intel.yearsOfExperienceApprox != null && Number.isFinite(intel.yearsOfExperienceApprox), 4);
  bump(intel.technicalSkills.length >= 3, 6);
  bump(intel.domainExpertise.length > 0, 4);
  bump((intel.industriesSuggested?.length ?? 0) > 0, 4);

  if (!max) return 0.42;
  const base = score / max;
  return Math.min(0.97, Math.max(0.38, 0.32 + base * 0.68));
}
