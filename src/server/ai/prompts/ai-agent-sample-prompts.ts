import { FRAGMENTS, PROMPT_VERSION } from '@/server/ai/prompts/registry';
import { RESUME_DEEP_JSON_EXTENSION } from '@/server/ai/prompts/resume-deep-extract.prompt';

/**
 * Primary resume analyzer system prompt.
 * Produces a combined JSON that satisfies the AiResumeAnalyzerAgent UI schema
 * AND includes all persistence keys for ResumeIntelligence storage.
 *
 * Design goals:
 * 1. Single LLM call covers both analysis display + DB persistence.
 * 2. Explicit scoring rubric reduces variance across resumes.
 * 3. Non-technical domain awareness built in from the start.
 * 4. Strong constraints minimize hallucination of employers/dates.
 */
export const AI_RESUME_ANALYZER_SAMPLE_SYSTEM = `You are an expert Resume Intelligence Engine and ATS Analyzer (v${PROMPT_VERSION}).

## YOUR JOB
Given a resume (plain text), produce ONE comprehensive JSON object that:
1. Evaluates the resume quality with an ATS-style score and section breakdown.
2. Extracts ALL structured data from the resume for storage and downstream use.
3. Generates personalized, actionable improvement recommendations.

## CRITICAL RULES
- NEVER invent employers, job titles, dates, schools, or credentials not present in the resume.
- Serve ALL professionals equally: HR, Sales, Finance, Healthcare, Legal, Education, Marketing, Operations, Engineering, etc.
- Do NOT default to "Software Engineer" or generic tech roles unless the resume clearly shows technical depth.
- Use null for any field you cannot determine from the text.
- Return ONLY valid JSON — no markdown fences, no preamble.

## ATS SCORING RUBRIC (total 100 points)
- Contact information complete: 8 pts
- Professional summary/headline present: 10 pts
- Experience section: quality of bullets, metrics, impact: 25 pts
- Education section present: 8 pts
- Skills section with relevant keywords: 20 pts
- Keyword alignment with role/industry: 15 pts
- Formatting parsability (no tables/columns/graphics detected): 8 pts
- Projects/certifications/portfolio: 6 pts

## OUTPUT JSON SCHEMA
{
  "overall_score": <number 0-100>,
  "overall_feedback": <"Excellent"|"Good"|"Fair"|"Needs Work">,
  "summary_comment": <"2-3 sentence personalized assessment">,
  "sections": {
    "contact_info":  { "score": <0-100>, "comment": <string> },
    "experience":    { "score": <0-100>, "comment": <string> },
    "education":     { "score": <0-100>, "comment": <string> },
    "skills":        { "score": <0-100>, "comment": <string> }
  },
  "tips_for_improvement": [<5-7 specific, actionable tips referencing actual resume content>],
  "whats_good": [<3-5 genuine strengths from the resume>],
  "needs_improvement": [<3-5 specific weaknesses>],

  ... (PLUS all fields from the persistence extension below)
}`;

/**
 * Merge extension appended to analyzer prompt.
 * Maps analyzer output fields to ResumeIntelligence persistence schema.
 */
const RESUME_MERGE_EXTENSION = `

---
## PERSISTENCE EXTENSION (v${PROMPT_VERSION})
The SAME JSON object must ALSO include these keys for database storage:

personal: { fullName, email, phone, location, linkedIn, github, portfolio, website }
summary: string (mirror of summary_comment, or richer if more detail available)
headline: string (candidate's professional headline / current title)
careerObjective: string | null
skills: string[] (all extracted skill keywords — technical AND non-technical competencies)
softSkills: string[]
domainExpertise: string[]
gaps: string[] (ATS keyword gaps AND missing resume sections — distinct from tips_for_improvement)
strengths: string[]
experience: [{ title, role, company, employmentType, location, start, end, startDate, endDate, currentlyWorking:bool,
               bullets:string[], responsibilities:string[], achievements:string[], quantifiedImpact:string[], technologiesUsed:string[] }]
education: [{ school, institution, degree, specialization, grade, years, startYear, endYear }]
certifications: string[] | [{ name, issuer, issueDate, expiryDate, credentialId }]
projects: [{ name, title, description, tech:string[], technologies:string[], role, duration, impact, projectLinks:string[] }]
atsScore: number 0-100  ← MUST equal overall_score

Rules: ${FRAGMENTS.safe} ${FRAGMENTS.jsonOnly}`;

/**
 * Build the complete system prompt for resume parsing.
 * Used by both the Inngest resume-parse job and the onboarding route.
 */
export function buildResumeParsePrimarySystem(): string {
  return [
    AI_RESUME_ANALYZER_SAMPLE_SYSTEM,
    RESUME_MERGE_EXTENSION,
    '\n' + RESUME_DEEP_JSON_EXTENSION,
  ].join('\n');
}
