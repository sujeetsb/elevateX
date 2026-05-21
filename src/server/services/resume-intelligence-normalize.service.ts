import { logger } from '@/server/logger';
import {
  geminiResumeMergedResponseSchema,
  resumeAnalyzerReportSchema,
  resumeEducationArraySchema,
  resumeExperienceArraySchema,
  resumeIntelligenceSchema,
  resumePersonalPartialSchema,
  resumeProjectsArraySchema,
  type GeminiResumeMergedResponse,
  type ResumeIntelligence,
} from '@/server/ai/schemas';
import { buildFallbackResumeIntelligence } from '@/server/services/resume-intelligence-fallback';
import { z } from 'zod';
import {
  computeExtractionConfidence,
  sanitizeTargetRolesSuggested,
} from '@/server/services/resume-post-process';

function clamp100(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(100, Math.max(0, Math.round(n)));
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0.5;
  return Math.min(1, Math.max(0, n));
}

function pickYearsApprox(raw: unknown, fallback: number | null | undefined): number | null | undefined {
  if (raw === undefined) return fallback;
  if (raw === null) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

function safePersonal(raw: unknown): ResumeIntelligence['personal'] | undefined {
  const p = resumePersonalPartialSchema.safeParse(raw);
  return p.success ? p.data : undefined;
}

function safeExperience(raw: unknown): ResumeIntelligence['experience'] {
  const p = resumeExperienceArraySchema.safeParse(raw);
  return p.success ? p.data : [];
}

function safeEducation(raw: unknown): ResumeIntelligence['education'] {
  const p = resumeEducationArraySchema.safeParse(raw);
  return p.success ? p.data : [];
}

function safeProjects(raw: unknown): ResumeIntelligence['projects'] {
  const p = resumeProjectsArraySchema.safeParse(raw);
  return p.success ? p.data : [];
}

const stringListSchema = z.array(z.string());

function safeStringList(raw: unknown): string[] {
  const p = stringListSchema.safeParse(raw);
  return p.success ? p.data.map(s => s.trim()).filter(Boolean) : [];
}

const confidenceRecordSchema = z.record(z.number());

function safeConfidence(raw: unknown): ResumeIntelligence['confidence'] | undefined {
  const p = confidenceRecordSchema.safeParse(raw);
  return p.success ? p.data : undefined;
}

/** Dedupe strings; optional case-insensitive keying for skills. */
export function dedupeStrings(values: string[], caseInsensitive = false): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of values) {
    const v = typeof raw === 'string' ? raw.trim() : '';
    if (!v) continue;
    const key = caseInsensitive ? v.toLowerCase() : v;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(v);
  }
  return out;
}

function mergePersonal(
  base: ResumeIntelligence['personal'],
  patch: ResumeIntelligence['personal'] | undefined,
): ResumeIntelligence['personal'] {
  if (!patch) return base;
  const out = { ...base };
  for (const [k, val] of Object.entries(patch)) {
    if (val != null && String(val).trim() !== '') {
      (out as Record<string, unknown>)[k] = val;
    }
  }
  return out;
}

function normalizeSection(
  raw: { score?: unknown; comment?: unknown } | undefined,
): { score: number; comment?: string | null } | undefined {
  if (!raw) return undefined;
  const scoreRaw = raw.score;
  const comment = raw.comment != null ? String(raw.comment) : undefined;
  if (scoreRaw == null && (comment == null || comment === '')) return undefined;
  return {
    score: scoreRaw != null ? clamp100(Number(scoreRaw)) : 0,
    comment: comment ?? null,
  };
}

function buildAnalyzerReportPatch(
  d: GeminiResumeMergedResponse,
): ResumeIntelligence['analyzerReport'] {
  const tips = dedupeStrings(d.tips_for_improvement ?? []);
  const good = dedupeStrings(d.whats_good ?? []);
  const bad = dedupeStrings(d.needs_improvement ?? []);
  const hasCore =
    d.overall_score != null ||
    (d.overall_feedback != null && String(d.overall_feedback).trim() !== '') ||
    (d.summary_comment != null && String(d.summary_comment).trim() !== '') ||
    tips.length > 0 ||
    good.length > 0 ||
    bad.length > 0 ||
    !!d.sections;

  if (!hasCore) return undefined;

  const sec = d.sections;
  const sections =
    sec == null
      ? undefined
      : {
          contact_info: normalizeSection(sec.contact_info as { score?: unknown; comment?: unknown }),
          experience: normalizeSection(sec.experience as { score?: unknown; comment?: unknown }),
          education: normalizeSection(sec.education as { score?: unknown; comment?: unknown }),
          skills: normalizeSection(sec.skills as { score?: unknown; comment?: unknown }),
        };

  const patch = {
    overall_score: d.overall_score != null ? clamp100(Number(d.overall_score)) : undefined,
    overall_feedback: d.overall_feedback ?? undefined,
    summary_comment: d.summary_comment ?? undefined,
    sections,
    tips_for_improvement: tips,
    whats_good: good,
    needs_improvement: bad,
  };

  const checked = resumeAnalyzerReportSchema.partial().safeParse(patch);
  if (!checked.success) {
    logger.warn('resume.normalize analyzerReport partial failed', { issues: checked.error.flatten() });
    return undefined;
  }
  return checked.data;
}

function mergeConfidence(
  base: ResumeIntelligence['confidence'],
  model: ResumeIntelligence['confidence'] | undefined,
  analyzerOverall: number | undefined,
  sections: GeminiResumeMergedResponse['sections'],
): ResumeIntelligence['confidence'] {
  const out: Record<string, number> = { ...(base ?? {}) };
  if (model) {
    for (const [k, v] of Object.entries(model)) {
      if (typeof v === 'number' && Number.isFinite(v)) out[k] = clamp01(v);
    }
  }
  if (sections && typeof sections === 'object') {
    for (const key of ['contact_info', 'experience', 'education', 'skills'] as const) {
      const s = sections[key] as { score?: unknown } | undefined;
      if (s?.score != null && Number.isFinite(Number(s.score))) {
        out[`section_${key}`] = clamp01(Number(s.score) / 100);
      }
    }
  }
  const overall =
    (typeof out.overall === 'number' && Number.isFinite(out.overall) ? out.overall : undefined) ??
    (analyzerOverall != null ? clamp01(analyzerOverall / 100) : undefined) ??
    0.75;
  out.overall = overall;
  return out;
}

function normalizeCertificationsList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const c of raw) {
    if (typeof c === 'string') {
      const t = c.trim();
      if (t) out.push(t);
      continue;
    }
    if (!c || typeof c !== 'object') continue;
    const o = c as Record<string, unknown>;
    const name = typeof o.name === 'string' ? o.name.trim() : '';
    if (!name) continue;
    const issuer = typeof o.issuer === 'string' ? o.issuer.trim() : '';
    const id = typeof o.credentialId === 'string' ? o.credentialId.trim() : '';
    out.push([name, issuer && `(${issuer})`, id && `#${id}`].filter(Boolean).join(' '));
  }
  return dedupeStrings(out, false);
}

function normalizeExperienceRows(rows: ResumeIntelligence['experience']): ResumeIntelligence['experience'] {
  return rows.map(ex => {
    const title = ex.title ?? ex.role ?? null;
    const start = ex.start ?? ex.startDate ?? null;
    const end = ex.end ?? ex.endDate ?? null;
    const resp = ex.responsibilities ?? [];
    const ach = ex.achievements ?? [];
    const qi = ex.quantifiedImpact ?? [];
    const bullets =
      ex.bullets?.length && ex.bullets.some(Boolean)
        ? ex.bullets
        : dedupeStrings([...resp, ...ach, ...qi], false).slice(0, 40);
    return { ...ex, title, start, end, bullets };
  });
}

function normalizeEducationRows(rows: ResumeIntelligence['education']): ResumeIntelligence['education'] {
  return rows.map(ed => {
    const school = ed.school ?? ed.institution ?? null;
    let years = ed.years ?? null;
    if (!years && (ed.startYear != null || ed.endYear != null)) {
      years = [ed.startYear, ed.endYear].filter(y => y != null).join(' – ') || null;
    }
    return { ...ed, school, years };
  });
}

function pickStr(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined;
  const t = v.trim();
  return t || undefined;
}

/**
 * Validates loose Gemini JSON, merges with heuristic fallback, dedupes list fields,
 * and returns a strict `ResumeIntelligence` for persistence.
 */
export function normalizeGeminiResumeMerge(raw: unknown, resumeText: string): ResumeIntelligence {
  const fallback = buildFallbackResumeIntelligence(resumeText);
  const parsed = geminiResumeMergedResponseSchema.safeParse(raw);

  if (!parsed.success) {
    logger.warn('resume.normalize gemini merge schema failed, using heuristic fallback', {
      issues: parsed.error.flatten(),
    });
    return fallback;
  }

  const d = parsed.data;
  const rawD = d as Record<string, unknown>;
  const analyzerReport = buildAnalyzerReportPatch(d);

  const professional =
    rawD.professional && typeof rawD.professional === 'object'
      ? (rawD.professional as Record<string, unknown>)
      : null;
  const skillsBuckets =
    rawD.skillsBuckets && typeof rawD.skillsBuckets === 'object'
      ? (rawD.skillsBuckets as Record<string, unknown>)
      : null;
  const insights =
    rawD.insights && typeof rawD.insights === 'object' ? (rawD.insights as Record<string, unknown>) : null;
  const additional =
    rawD.additional && typeof rawD.additional === 'object' ? (rawD.additional as Record<string, unknown>) : null;

  const atsFromInsights =
    insights && insights.atsScore != null && Number.isFinite(Number(insights.atsScore))
      ? clamp100(Number(insights.atsScore))
      : undefined;
  const atsFromAnalyzer = d.overall_score != null ? clamp100(Number(d.overall_score)) : undefined;
  const atsFromModel = d.atsScore != null ? clamp100(Number(d.atsScore)) : undefined;
  const atsScore = atsFromAnalyzer ?? atsFromModel ?? atsFromInsights ?? fallback.atsScore;

  const summaryFromProf = pickStr(professional?.summary);
  const summary =
    (d.summary ?? d.summary_comment ?? summaryFromProf ?? fallback.summary)?.toString().trim() || fallback.summary;
  const headline =
    pickStr(rawD.headline) ??
    pickStr(professional?.headline) ??
    pickStr(rawD.professionalHeadline) ??
    pickStr(insights?.headline as string);
  const careerObjective =
    pickStr(rawD.careerObjective) ??
    pickStr(professional?.careerObjective) ??
    pickStr(rawD.objective) ??
    pickStr(insights?.careerObjective as string);

  const technicalSkills = dedupeStrings(
    [...safeStringList(rawD.technicalSkills), ...safeStringList(skillsBuckets?.technicalSkills)],
    true,
  );
  const tools = dedupeStrings([...safeStringList(rawD.tools), ...safeStringList(skillsBuckets?.tools)], true);
  const platforms = dedupeStrings(
    [...safeStringList(rawD.platforms), ...safeStringList(skillsBuckets?.platforms)],
    true,
  );
  const languages = dedupeStrings(
    [...safeStringList(rawD.languages), ...safeStringList(skillsBuckets?.languages)],
    true,
  );
  const bucketSoft = safeStringList(skillsBuckets?.softSkills);

  const skills = dedupeStrings(
    [
      ...safeStringList(d.skills),
      ...technicalSkills,
      ...tools,
      ...platforms,
      ...languages,
      ...bucketSoft,
      ...fallback.skills,
    ],
    true,
  );

  const gapLists = dedupeStrings([
    ...safeStringList(d.gaps),
    ...(insights ? safeStringList(insights.gaps) : []),
    ...(d.tips_for_improvement ?? []),
    ...(d.needs_improvement ?? []),
  ]);
  const gaps = gapLists.length ? gapLists : fallback.gaps;

  const strengths = dedupeStrings([
    ...safeStringList(rawD.strengths),
    ...(insights ? safeStringList(insights.strengths) : []),
    ...(d.whats_good ?? []),
    ...(analyzerReport?.whats_good ?? []),
  ]);

  const industriesSuggested = dedupeStrings([
    ...safeStringList(rawD.industriesSuggested),
    ...(insights ? safeStringList(insights.industriesSuggested) : []),
  ]);

  const expRaw = safeExperience(d.experience);
  const experience = normalizeExperienceRows(expRaw.length ? expRaw : fallback.experience);
  const eduRaw = safeEducation(d.education);
  const education = normalizeEducationRows(eduRaw.length ? eduRaw : fallback.education);

  const projectsParsed = safeProjects(d.projects);
  const projects = projectsParsed.length ? projectsParsed : fallback.projects;

  const certificationsRaw = rawD.certifications ?? d.certifications;
  const certificationsParsed = normalizeCertificationsList(certificationsRaw);
  const certifications = certificationsParsed.length ? certificationsParsed : fallback.certifications;

  const softSkillsParsed = dedupeStrings(
    [...safeStringList(d.softSkills), ...bucketSoft],
    false,
  );
  const softSkills = softSkillsParsed.length ? softSkillsParsed : fallback.softSkills;

  const domainParsed = dedupeStrings([
    ...safeStringList(d.domainExpertise),
    ...(insights ? safeStringList(insights.domainExpertise) : []),
  ]);
  const domainExpertise = domainParsed.length ? domainParsed : fallback.domainExpertise;

  const rolesParsed = dedupeStrings([
    ...safeStringList(d.targetRolesSuggested),
    ...(insights ? safeStringList(insights.targetRolesSuggested) : []),
  ]);

  const yearsOfExperienceApprox = pickYearsApprox(
    (d.yearsOfExperienceApprox ?? insights?.yearsOfExperienceApprox) as number | null | undefined,
    fallback.yearsOfExperienceApprox,
  );

  const careerLevel = pickStr(rawD.careerLevel) ?? pickStr(insights?.careerLevel as string);
  const awards = dedupeStrings([
    ...safeStringList(rawD.awards),
    ...(additional ? safeStringList(additional.awards) : []),
  ]);
  const publications = dedupeStrings([
    ...safeStringList(rawD.publications),
    ...(additional ? safeStringList(additional.publications) : []),
  ]);
  const volunteering = dedupeStrings([
    ...safeStringList(rawD.volunteering),
    ...(additional ? safeStringList(additional.volunteering) : []),
  ]);
  const leadership = dedupeStrings([
    ...safeStringList(rawD.leadership),
    ...(additional ? safeStringList(additional.leadership) : []),
  ]);
  const interests = dedupeStrings([
    ...safeStringList(rawD.interests),
    ...(additional ? safeStringList(additional.interests) : []),
  ]);
  const extracurricularActivities = dedupeStrings([
    ...safeStringList(rawD.extracurricularActivities),
    ...(additional ? safeStringList(additional.extracurricularActivities) : []),
  ]);

  const merged: ResumeIntelligence = {
    personal: mergePersonal(fallback.personal, safePersonal(d.personal)),
    summary,
    headline: headline ?? null,
    careerObjective: careerObjective ?? null,
    skills: skills.length ? skills : fallback.skills,
    technicalSkills: technicalSkills.length ? technicalSkills : fallback.technicalSkills,
    tools: tools.length ? tools : fallback.tools,
    platforms: platforms.length ? platforms : fallback.platforms,
    languages: languages.length ? languages : fallback.languages,
    gaps,
    strengths: strengths.length ? strengths : fallback.strengths,
    experience,
    education,
    certifications,
    projects,
    softSkills,
    domainExpertise,
    industriesSuggested: industriesSuggested.length ? industriesSuggested : fallback.industriesSuggested,
    targetRolesSuggested: rolesParsed.length ? rolesParsed : fallback.targetRolesSuggested,
    yearsOfExperienceApprox,
    careerLevel: careerLevel ?? null,
    atsScore,
    confidence: mergeConfidence(
      fallback.confidence,
      safeConfidence(d.confidence),
      atsFromAnalyzer ?? atsFromModel ?? atsFromInsights ?? atsScore,
      d.sections,
    ),
    analyzerReport: analyzerReport ?? undefined,
    awards: awards.length ? awards : fallback.awards,
    publications: publications.length ? publications : fallback.publications,
    volunteering: volunteering.length ? volunteering : fallback.volunteering,
    leadership: leadership.length ? leadership : fallback.leadership,
    interests: interests.length ? interests : fallback.interests,
    extracurricularActivities: extracurricularActivities.length
      ? extracurricularActivities
      : fallback.extracurricularActivities,
  };

  merged.targetRolesSuggested = sanitizeTargetRolesSuggested(
    merged.targetRolesSuggested,
    resumeText,
    merged,
  );

  const completeness = computeExtractionConfidence(merged);
  const prevOverall =
    typeof merged.confidence?.overall === 'number' && Number.isFinite(merged.confidence.overall)
      ? merged.confidence.overall
      : 0;
  merged.confidence = {
    ...(merged.confidence ?? {}),
    overall: Math.max(prevOverall, completeness),
    extraction_completeness: completeness,
  };

  const finalParse = resumeIntelligenceSchema.safeParse(merged);
  if (!finalParse.success) {
    logger.warn('resume.normalize final resumeIntelligenceSchema failed, using fallback', {
      issues: finalParse.error.flatten(),
    });
    return fallback;
  }

  return finalParse.data;
}
