import type { ResumeDocument } from '@/lib/resume/types';
import type { JobDocumentTemplate } from '@/lib/documents/types';

/** Build a minimal valid ResumeDocument from profile + AI fields. */
export function buildResumeDocumentFromParts(parts: {
  fullName: string;
  email: string;
  phone?: string;
  location?: string;
  linkedIn?: string;
  headline?: string;
  summary?: string;
  skills?: string[];
  experience?: Array<{ role: string; company: string; start?: string; end?: string; bullets?: string[] }>;
  education?: Array<{ school: string; degree: string; start?: string; end?: string }>;
}): ResumeDocument {
  return {
    personal: {
      fullName: parts.fullName || 'Applicant',
      email: parts.email || '',
      phone: parts.phone ?? '',
      location: parts.location ?? '',
      linkedIn: parts.linkedIn,
      headline: parts.headline,
    },
    summary: parts.summary ?? '',
    skills: parts.skills ?? [],
    experience: (parts.experience ?? []).map((e, i) => ({
      id: `exp-${i}`,
      company: e.company,
      role: e.role,
      start: e.start ?? '',
      end: e.end ?? 'Present',
      bullets: e.bullets ?? [],
    })),
    education: (parts.education ?? []).map((e, i) => ({
      id: `edu-${i}`,
      school: e.school,
      degree: e.degree,
      start: e.start ?? '',
      end: e.end ?? '',
    })),
    projects: [],
    certifications: [],
    achievements: [],
    sectionOrder: ['summary', 'experience', 'skills', 'education'],
  };
}

export function resumeDocumentFromAiJson(raw: unknown, fallback: ResumeDocument): ResumeDocument {
  if (!raw || typeof raw !== 'object') return fallback;
  const o = raw as Record<string, unknown>;

  if (o.document && typeof o.document === 'object') {
    const d = o.document as Partial<ResumeDocument>;
    if (d.personal?.fullName) {
      return {
        ...fallback,
        ...d,
        personal: { ...fallback.personal, ...d.personal },
        experience: Array.isArray(d.experience) ? d.experience : fallback.experience,
        skills: Array.isArray(d.skills) ? d.skills.map(String) : fallback.skills,
        education: Array.isArray(d.education) ? d.education : fallback.education,
      };
    }
  }

  if (o.personal && typeof o.personal === 'object') {
    return buildResumeDocumentFromParts({
      fullName: String((o.personal as Record<string, unknown>).fullName ?? fallback.personal.fullName),
      email: String((o.personal as Record<string, unknown>).email ?? fallback.personal.email),
      summary: String(o.summary ?? fallback.summary),
      skills: Array.isArray(o.skills) ? o.skills.map(String) : fallback.skills,
      experience: Array.isArray(o.experience)
        ? (o.experience as Array<Record<string, unknown>>).map(e => ({
            role: String(e.role ?? e.title ?? ''),
            company: String(e.company ?? ''),
            start: String(e.start ?? ''),
            end: String(e.end ?? 'Present'),
            bullets: Array.isArray(e.bullets) ? e.bullets.map(String) : [],
          }))
        : fallback.experience.map(e => ({ role: e.role, company: e.company, start: e.start, end: e.end, bullets: e.bullets })),
    });
  }

  return fallback;
}

export const DEFAULT_JOB_RESUME_TEMPLATE: JobDocumentTemplate = 'professional';
