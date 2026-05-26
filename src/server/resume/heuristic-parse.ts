import type { ResumeParseResult } from '@/types/resume-parse-result';

/** Fast client-facing parse (no LLM) — full intelligence runs in Inngest. */
export function heuristicResumeParse(rawText: string): ResumeParseResult {
  const text = rawText.replace(/\r\n/g, '\n').slice(0, 50_000);
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  const phoneMatch = text.match(/\+?\d[\d\s().-]{8,}\d/);

  // Try to detect a name: first line that looks like only a person's name (letters/spaces/dots).
  // A real name is unlikely to contain digits, @, or common sentence patterns.
  const nameLine = lines
    .slice(0, 5)
    .find(l => /^[a-zA-Z][a-zA-Z\s.'-]{1,60}$/.test(l) && !/\b(resume|curriculum|vitae|cv|profile|summary|objective)\b/i.test(l));
  const name = nameLine?.slice(0, 80) || '';

  const skillHints = [
    'TypeScript',
    'JavaScript',
    'React',
    'Node',
    'Python',
    'AWS',
    'SQL',
    'GraphQL',
    'Docker',
    'Kubernetes',
    'Go',
    'Java',
    'C++',
    'Rust',
    'CSS',
    'HTML',
    'Next.js',
    'PostgreSQL',
    'MongoDB',
    'Redis',
  ];
  const skills = skillHints.filter(s => new RegExp(`\\b${s.replace(/[.+]/g, '\\$&')}\\b`, 'i').test(text));

  // Only extract years from text — don't inject fallback strings like "See resume"
  const yearsMatch = text.match(/(\d+)\+?\s*(years?|yrs?)\s*(of\s+)?experience/i);
  const experience = yearsMatch ? `${yearsMatch[1]} years` : '';

  // currentRole: detect a job title line, empty string if not found
  const currentRole =
    lines.find(l =>
      /\b(nurse|teacher|accountant|attorney|paralegal|recruiter|sales|marketing|hr\b|human resources|operations|finance|banking|consultant|physician|therapist|chef|coordinator|specialist|representative|executive|assistant|director|manager|analyst|designer|engineer|developer|programmer)\b/i.test(
        l,
      ) && l.length < 100,
    )?.slice(0, 80) || '';

  return {
    name,
    currentRole,
    experience,
    // Empty skills array is fine — mergeParsed merges additively, Inngest will fill the real list
    skills: skills.slice(0, 16),
    summary: `Imported resume (${lines.length} lines). ${emailMatch ? 'Email detected. ' : ''}${phoneMatch ? 'Phone detected. ' : ''}AI will refine profile after upload.`,
    email: emailMatch?.[0] ?? undefined,
  };
}
