/**
 * Client-side mapping of `Resume.parsedJson` (ResumeIntelligence-like) into onboarding form fields.
 * Kept in `lib/` so it can run in the browser without server-only imports.
 */
export type OnboardingPrefillFromResume = {
  name?: string;
  email?: string;
  linkedIn?: string;
  currentRole?: string;
  targetRole?: string;
  experience?: string;
  skills?: string[];
  summary?: string;
  careerGoal?: string;
  education?: string;
};

function strArr(v: unknown): string[] {
  return Array.isArray(v)
    ? v.filter((x): x is string => typeof x === 'string' && x.trim() !== '').map(s => s.trim())
    : [];
}

function dedupeSkillsPreserveOrder(skills: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of skills) {
    const k = s.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(s);
  }
  return out;
}

export function mapResumeParsedJsonToOnboardingPrefill(parsed: unknown): OnboardingPrefillFromResume {
  if (!parsed || typeof parsed !== 'object') return {};
  const p = parsed as Record<string, unknown>;
  const personal =
    p.personal && typeof p.personal === 'object' ? (p.personal as Record<string, unknown>) : {};

  const skills = dedupeSkillsPreserveOrder([
    ...strArr(p.skills),
    ...strArr(p.technicalSkills),
    ...strArr(p.tools),
    ...strArr(p.platforms),
    ...strArr(p.languages),
    ...strArr(p.softSkills),
  ]);
  // targetRolesSuggested is for "where the candidate wants to go" — not current role
  const roles = strArr(p.targetRolesSuggested);
  const expArr = Array.isArray(p.experience) ? p.experience : [];
  const firstExp =
    expArr[0] && typeof expArr[0] === 'object' ? (expArr[0] as Record<string, unknown>) : null;
  const expTitleRaw =
    (typeof firstExp?.role === 'string' && firstExp.role.trim()) ||
    (typeof firstExp?.title === 'string' && firstExp.title.trim()) ||
    '';
  const expTitle = expTitleRaw;
  const expCompany = typeof firstExp?.company === 'string' ? firstExp.company.trim() : '';

  // yearsOfExperienceApprox is the canonical field; fall back to common Gemini variants and string form
  const yearsRaw =
    p.yearsOfExperienceApprox ??
    p.yearsOfExperience ??
    p.totalYearsExperience ??
    p.totalExperience ??
    p.experienceYears;
  const yearsNum =
    typeof yearsRaw === 'number' && Number.isFinite(yearsRaw)
      ? yearsRaw
      : typeof yearsRaw === 'string' && yearsRaw.trim() && Number.isFinite(Number(yearsRaw))
        ? Number(yearsRaw)
        : null;
  const yearsStr = yearsNum !== null ? `${yearsNum} years` : undefined;
  const expLine = [expTitle, expCompany].filter(Boolean).join(' @ ');
  const experience = yearsStr || (expLine ? expLine.slice(0, 120) : undefined);

  const analyzer =
    p.analyzerReport && typeof p.analyzerReport === 'object'
      ? (p.analyzerReport as Record<string, unknown>)
      : null;
  const summaryFromAnalyzer =
    typeof analyzer?.summary_comment === 'string' ? analyzer.summary_comment.trim() : undefined;
  const headline = typeof p.headline === 'string' && p.headline.trim() ? p.headline.trim() : undefined;
  const careerObjective =
    typeof p.careerObjective === 'string' && p.careerObjective.trim() ? p.careerObjective.trim() : undefined;
  const summary =
    typeof p.summary === 'string' && p.summary.trim()
      ? p.summary.trim()
      : summaryFromAnalyzer || headline || careerObjective || undefined;

  const tips = analyzer && Array.isArray(analyzer.tips_for_improvement) ? strArr(analyzer.tips_for_improvement) : [];
  const gaps = strArr(p.gaps);
  const careerGoal =
    careerObjective ||
    (roles[0] && expTitle
      ? `Grow from ${expTitle} toward ${roles[0]} over the next 2–3 years`
      : roles[0]
        ? `Advance my career toward ${roles[0]}`
        : undefined) ||
    tips.slice(0, 3).join('. ') ||
    gaps.slice(0, 3).join('. ') ||
    (analyzer && Array.isArray(analyzer.needs_improvement)
      ? strArr(analyzer.needs_improvement).slice(0, 2).join('. ')
      : undefined);

  const eduArr = Array.isArray(p.education) ? p.education : [];
  const education = eduArr
    .map(e => {
      if (!e || typeof e !== 'object') return '';
      const o = e as Record<string, unknown>;
      const school =
        (typeof o.institution === 'string' && o.institution.trim()) ||
        (typeof o.school === 'string' && o.school.trim()) ||
        '';
      const degree = typeof o.degree === 'string' ? o.degree.trim() : '';
      const spec = typeof o.specialization === 'string' ? o.specialization.trim() : '';
      const grade = typeof o.grade === 'string' ? o.grade.trim() : '';
      let years = typeof o.years === 'string' && o.years.trim() ? o.years.trim() : '';
      if (!years && (o.startYear != null || o.endYear != null)) {
        const sy = o.startYear != null && o.startYear !== '' ? String(o.startYear) : '';
        const ey = o.endYear != null && o.endYear !== '' ? String(o.endYear) : '';
        years = [sy, ey].filter(Boolean).join(' – ');
      }
      return [school, degree, spec, grade, years].filter(Boolean).join(' — ');
    })
    .filter(Boolean)
    .join('\n') || undefined;

  // Name: prefer personal.fullName (canonical), then personal.name, then top-level p.name
  const name =
    (typeof personal.fullName === 'string' && personal.fullName.trim()) ||
    (typeof personal.name === 'string' && personal.name.trim()) ||
    (typeof p.name === 'string' && p.name.trim()) ||
    undefined;

  const email =
    (typeof personal.email === 'string' && personal.email.trim()) ||
    (typeof p.email === 'string' && p.email.trim()) ||
    undefined;

  // LinkedIn: check personal object (both cases) and top-level fallbacks
  const linkedInRaw =
    (typeof personal.linkedIn === 'string' && personal.linkedIn.trim()) ||
    (typeof personal.linkedin === 'string' && personal.linkedin.trim()) ||
    (typeof p.linkedIn === 'string' && p.linkedIn.trim()) ||
    (typeof p.linkedin === 'string' && p.linkedin.trim()) ||
    '';
  const linkedIn = linkedInRaw || undefined;

  return {
    name,
    email,
    linkedIn,
    // currentRole = what the candidate currently does (from experience), NOT from suggested future roles
    currentRole: expTitle || headline || undefined,
    // targetRole = where the candidate wants to go (from AI-suggested roles), NOT from current experience
    targetRole: roles[0] || undefined,
    experience,
    skills: skills.length ? skills : undefined,
    summary,
    careerGoal: careerGoal || undefined,
    education,
  };
}
