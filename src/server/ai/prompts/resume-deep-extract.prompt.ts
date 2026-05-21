/**
 * Deep structured resume extraction extension.
 * Appended to the primary analyzer prompt so a single Gemini response
 * satisfies both the UI analysis schema AND the full intelligence schema.
 *
 * Sync with: resumeIntelligenceSchema, normalizeGeminiResumeMerge
 */
export const RESUME_DEEP_JSON_EXTENSION = `
---
## DEEP EXTRACTION SPEC — Extract EVERYTHING evidenced in the resume.

### candidateProfile
{
  isTechnicalCandidate: boolean  // true ONLY if resume demonstrates software/data/devops depth
}

### personal
{ fullName, email, phone, location, linkedIn, github, portfolio, website }

### professional
{ summary:string, headline:string, careerObjective:string | null }

### experience (array)
[{
  title: string,             // job title
  role: string,              // role if different from title
  company: string,
  employmentType: string,    // "full-time" | "part-time" | "contract" | "freelance" | "internship"
  location: string,
  start: string,             // "Jan 2022" style
  end: string | "Present",
  startDate: string,         // ISO if determinable
  endDate: string | null,
  currentlyWorking: boolean,
  bullets: string[],
  responsibilities: string[],
  achievements: string[],
  quantifiedImpact: string[],  // lines with numbers/percentages/$ amounts
  technologiesUsed: string[]
}]

### education (array)
[{
  school: string,
  institution: string,
  degree: string,
  specialization: string,
  grade: string,             // GPA, percentage, or honors
  years: string,             // "2018–2022"
  startYear: number | null,
  endYear: number | null
}]

### skillsBuckets
{
  technicalSkills: string[],   // hard technical skills
  softSkills: string[],
  tools: string[],             // software tools, IDEs, platforms
  platforms: string[],         // cloud, SaaS, operating systems
  languages: string[]          // programming languages OR spoken languages
}

### skills: string[]  — merged, deduplicated keywords (include non-tech competencies like "financial modeling", "patient care", "GAAP", etc.)

### projects (array)
[{
  name: string,
  title: string,
  description: string,
  tech: string[],
  technologies: string[],
  role: string,
  duration: string,
  impact: string,
  projectLinks: string[]
}]

### certifications
(string | { name, issuer, issueDate, expiryDate, credentialId })[]

### additional
{
  awards: string[],
  publications: string[],
  volunteering: string[],
  leadership: string[],
  interests: string[],
  extracurricularActivities: string[]
}

### insights
{
  atsScore: number 0-100,     // MUST equal overall_score above
  gaps: string[],             // missing keywords, absent sections, weak areas
  strengths: string[],
  domainExpertise: string[],
  careerLevel: "student"|"entry"|"mid"|"senior"|"lead"|"director"|"executive",
  targetRolesSuggested: string[],    // 3-8 SPECIFIC job titles matching actual experience
  industriesSuggested: string[],
  yearsOfExperienceApprox: number | null,
  confidence: { overall: number 0-1 }
}

### RULES FOR targetRolesSuggested
- Derive exclusively from job titles, headline, and domain signals in the resume.
- For NON-technical candidates: use their actual domain (HR, Sales, Nursing, Accounting, Teaching, Legal, Marketing, etc.)
- NEVER output "Engineering" or "Software" as a title for non-technical resumes.
- Examples: "Senior HR Business Partner", "Account Executive", "Registered Nurse", "Financial Analyst", "Marketing Manager"
- Minimum 3, maximum 8 specific titles.

Flatten skillsBuckets into top-level skills[]. Map additional.* to top-level arrays.
`.trim();
