import type { ResumeParseResult } from '@/types/resume-parse-result';
import type { ResumeIntelligence } from '@/server/ai/schemas';
import { generateJsonText } from '@/server/ai/gemini';
import { buildResumeParsePrimarySystem } from '@/server/ai/prompts/ai-agent-sample-prompts';
import { buildResumeUserPayload } from '@/server/resume/build-resume-user-payload';
import { heuristicResumeParse } from '@/server/resume/heuristic-parse';
import { normalizeGeminiResumeMerge } from '@/server/services/resume-intelligence-normalize.service';
import { env } from '@/lib/server-env';
import { logger } from '@/server/logger';
import { dedupeStrings } from '@/server/services/resume-intelligence-normalize.service';

function mergeSkillLists(intel: ResumeIntelligence): string[] {
  const merged = dedupeStrings(
    [
      ...intel.skills,
      ...intel.technicalSkills,
      ...intel.tools,
      ...intel.platforms,
      ...intel.languages,
      ...intel.softSkills,
    ],
    true,
  );
  return merged.slice(0, 48);
}

/** Maps persisted / Gemini-normalized intelligence to onboarding API + UI shape. */
export function mapResumeIntelligenceToParseResult(intel: ResumeIntelligence, rawText?: string): ResumeParseResult {
  const personal = intel.personal ?? {};

  // Use empty string when a field is unknown — mergeParsed guards against empty strings
  // so they will not overwrite fields the user has already typed.
  const name = personal.fullName?.trim() || '';

  // targetRolesSuggested = where the candidate WANTS to go, not where they currently are
  const firstTarget = intel.targetRolesSuggested?.find(Boolean)?.trim() || '';
  const firstExp = intel.experience?.[0];
  // currentRole comes from experience only, NOT from suggested future roles
  const expTitle = (firstExp?.role?.trim() || firstExp?.title?.trim() || '').trim();
  const expCompany = firstExp?.company?.trim() || '';
  const years =
    intel.yearsOfExperienceApprox != null && Number.isFinite(intel.yearsOfExperienceApprox)
      ? `${intel.yearsOfExperienceApprox} years`
      : '';
  const expSummary = [expTitle, expCompany].filter(Boolean).join(' @ ');
  // Use empty string when unknown — avoids "See resume" polluting the form field
  const experience = years || expSummary.slice(0, 120) || '';

  const summary =
    intel.summary?.trim() ||
    intel.headline?.trim() ||
    intel.careerObjective?.trim() ||
    intel.analyzerReport?.summary_comment?.trim() ||
    (intel.analyzerReport?.overall_feedback
      ? `${intel.analyzerReport.overall_feedback}. ATS-style score ${intel.atsScore}.`
      : `Imported profile (ATS score ${intel.atsScore}).`);

  const tips = intel.analyzerReport?.tips_for_improvement?.filter(Boolean).slice(0, 3).join(' ');
  const careerGoalHint =
    intel.careerObjective?.trim() ||
    tips ||
    intel.gaps?.slice(0, 3).filter(Boolean).join('. ') ||
    intel.analyzerReport?.needs_improvement?.slice(0, 2).filter(Boolean).join('. ');

  const education =
    intel.education
      ?.map(e => {
        const school = e.institution?.trim() || e.school?.trim() || '';
        const years =
          e.years?.trim() ||
          [e.startYear, e.endYear]
            .filter((y): y is number => typeof y === 'number' && Number.isFinite(y))
            .map(String)
            .join(' – ');
        return [school, e.degree, e.specialization, e.grade, years].filter(Boolean).join(' — ');
      })
      .filter(Boolean)
      .join('\n') || undefined;

  return {
    name,
    // currentRole = from work experience only, not from suggested future roles
    currentRole: expTitle,
    experience,
    skills: mergeSkillLists(intel),
    summary: summary.slice(0, 4000),
    rawText,
    email: personal.email?.trim() || undefined,
    linkedIn: personal.linkedIn?.trim() || undefined,
    // targetRole = from AI-suggested roles only, not from current job title
    targetRole: firstTarget || undefined,
    careerGoal: careerGoalHint?.slice(0, 2000) || undefined,
    education,
    certifications: intel.certifications?.length ? intel.certifications.slice(0, 32) : undefined,
  };
}

/**
 * Rich onboarding parse: Gemini + analyzer prompt when configured, else heuristic.
 */
export async function extractOnboardingResumeFromText(text: string): Promise<ResumeParseResult> {
  const trimmed = text.replace(/\r\n/g, '\n').slice(0, 100_000);
  if (!trimmed.trim()) {
    return { ...heuristicResumeParse(''), rawText: trimmed };
  }

  if (!env.GEMINI_API_KEY) {
    return { ...heuristicResumeParse(trimmed), rawText: trimmed };
  }

  try {
    const body = buildResumeUserPayload(trimmed).slice(0, 48_000);
    const { text: jsonText, model } = await generateJsonText({
      system: buildResumeParsePrimarySystem(),
      user: body,
      maxRetries: 2,
      maxOutputTokens: 6144,
    });
    logger.info('onboarding.resume_extract gemini_ok', { model });
    const raw = JSON.parse(jsonText) as unknown;
    const intel = normalizeGeminiResumeMerge(raw, trimmed);
    return mapResumeIntelligenceToParseResult(intel, trimmed);
  } catch (e) {
    logger.warn('onboarding.resume_extract fallback', { error: String(e) });
    return { ...heuristicResumeParse(trimmed), rawText: trimmed };
  }
}
