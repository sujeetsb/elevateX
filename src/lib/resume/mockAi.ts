import type { AISuggestion, OptimizeMode, ResumeDocument, SectionId } from './types';

const ATS_KEYWORDS = ['GraphQL', 'Testing', 'CI/CD', 'System Design', 'Leadership', 'Stakeholder', 'Agile', 'AWS'];

function uid() {
  return typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `id-${Date.now()}-${Math.random()}`;
}

export function buildInitialResumeFromProfile(user: {
  name: string;
  email: string;
  currentRole: string;
  experience: string;
  skills: string[];
  education: string;
  bio: string;
  projects: string[];
  certifications: string[];
  linkedIn: string;
  github: string;
  targetRole: string;
}): ResumeDocument {
  const bullets = [
    `Delivered ${user.currentRole} initiatives across web platforms with measurable user impact.`,
    `Collaborated cross-functionally to ship features aligned with ${user.targetRole} expectations.`,
    `Improved reliability and performance through code review, testing, and iterative delivery.`,
  ];

  return {
    personal: {
      fullName: user.name,
      email: user.email,
      phone: '+1 (555) 010-2048',
      location: 'San Francisco, CA',
      linkedIn: user.linkedIn || undefined,
      portfolio: user.github || undefined,
      headline: user.currentRole,
    },
    summary:
      user.bio ||
      `Results-driven ${user.currentRole} with ${user.experience} of experience. Passionate about building scalable products, mentoring peers, and partnering with design and product to ship outcomes users love.`,
    experience: [
      {
        id: uid(),
        company: 'TechCorp Inc.',
        role: user.currentRole,
        location: 'Remote',
        start: '2022',
        end: 'Present',
        bullets,
      },
    ],
    skills: [...user.skills],
    education: [
      {
        id: uid(),
        school: user.education.split(',')[0]?.trim() || 'University',
        degree: user.education.includes('B.') || user.education.includes('M.') ? user.education : `Degree — ${user.education}`,
        start: '2016',
        end: '2020',
      },
    ],
    projects: user.projects.length
      ? user.projects.map(p => ({
          id: uid(),
          name: p.slice(0, 48),
          description: 'Project contribution and outcomes.',
          tech: user.skills.slice(0, 4),
        }))
      : [
          {
            id: uid(),
            name: 'Portfolio Platform',
            description: 'End-to-end product work with analytics, auth, and responsive UI.',
            tech: user.skills.slice(0, 4),
          },
        ],
    certifications: user.certifications.map(c => ({
      id: uid(),
      name: c,
      issuer: 'Issuing org',
      date: '2024',
    })),
    achievements: [
      'Shipped high-impact features adopted by thousands of weekly active users.',
      'Reduced incident rate through better observability and testing practices.',
    ],
    sectionOrder: ['summary', 'experience', 'skills', 'projects', 'education', 'certifications', 'achievements'],
  };
}

export function generateSuggestions(doc: ResumeDocument): AISuggestion[] {
  const out: AISuggestion[] = [];
  const firstExp = doc.experience[0];
  if (firstExp?.bullets[0]) {
    out.push({
      id: uid(),
      type: 'bullet',
      sectionId: 'experience',
      title: 'Stronger achievement bullet',
      detail: 'Lead with outcome + metric + scope for ATS parsers.',
      replacement: `Improved core web vitals by 28% and cut p95 latency by 120ms for ${firstExp.company}'s primary checkout flow.`,
      targetPath: 'experience.0.bullets.0',
      status: 'pending',
    });
  }
  out.push({
    id: uid(),
    type: 'keyword',
    sectionId: 'skills',
    title: 'Missing ATS keyword',
    detail: `Add "${ATS_KEYWORDS[0]}" to skills or experience for better role alignment.`,
    replacement: ATS_KEYWORDS[0],
    status: 'pending',
  });
  out.push({
    id: uid(),
    type: 'actionVerb',
    sectionId: 'summary',
    title: 'Sharpen summary opening',
    detail: 'Replace passive phrasing with leadership-forward verbs.',
    replacement: `Senior ${doc.personal.headline || 'engineer'} leading roadmap delivery, platform quality, and cross-team alignment.`,
    status: 'pending',
  });
  out.push({
    id: uid(),
    type: 'readability',
    sectionId: 'summary',
    title: 'Tighten summary length',
    detail: 'Keep summary to 3 lines for recruiter skim patterns.',
    status: 'pending',
  });
  out.push({
    id: uid(),
    type: 'industry',
    sectionId: 'skills',
    title: 'Industry stack signal',
    detail: 'Surface cloud + delivery keywords common in senior IC loops.',
    replacement: 'AWS · Docker · GitHub Actions',
    status: 'pending',
  });
  out.push({
    id: uid(),
    type: 'recruiter',
    sectionId: 'experience',
    title: 'Recruiter scan line',
    detail: 'Add a one-line scope statement under your role title.',
    replacement: 'Owned roadmap for customer-facing growth surfaces (A/B, experimentation, analytics).',
    status: 'pending',
  });
  return out;
}

export function applyOptimizeMode(doc: ResumeDocument, mode: OptimizeMode): ResumeDocument {
  const next = structuredClone(doc) as ResumeDocument;
  if (mode === 'polish') {
    next.summary = next.summary.replace(/^/, '').trim();
    if (!next.summary.startsWith('Accomplished')) {
      next.summary = `Accomplished professional — ${next.summary}`;
    }
    next.skills = Array.from(new Set([...next.skills, ...ATS_KEYWORDS.slice(0, 2)]));
    next.experience = next.experience.map((e, i) => ({
      ...e,
      bullets: e.bullets.map((b, j) =>
        j === 0 ? `Led ${e.role} initiatives: ${b.replace(/^Delivered /, '')}` : b,
      ),
    }));
  }
  if (mode === 'rewrite') {
    next.summary = `Impact-focused ${next.personal.headline || 'professional'} with a track record of shipping reliable software, improving team velocity, and partnering with product and design to hit KPIs.`;
    next.experience = next.experience.map(e => ({
      ...e,
      bullets: [
        `Owned delivery for ${e.role} scope; improved quality gates and release cadence.`,
        `Partnered with stakeholders to prioritize roadmap and reduce cycle time.`,
        `Mentored engineers and raised bar on code review, testing, and documentation.`,
      ],
    }));
    next.skills = Array.from(new Set([...next.skills, ...ATS_KEYWORDS]));
  }
  if (mode === 'generate') {
    next.summary = `Executive-ready narrative: ${next.personal.fullName} drives outcomes across product engineering, platform reliability, and customer-facing growth. Known for crisp communication, measurable delivery, and raising engineering standards.`;
    next.achievements = [
      'Scaled platform serving 2M+ monthly active users with 99.95% availability.',
      'Drove hiring and onboarding program reducing ramp time by 30%.',
      ...next.achievements,
    ].slice(0, 5);
    next.skills = Array.from(new Set([...next.skills, ...ATS_KEYWORDS, 'OKRs', 'Mentorship']));
  }
  return next;
}

export function applySuggestionToDocument(doc: ResumeDocument, s: AISuggestion): ResumeDocument {
  const next = structuredClone(doc) as ResumeDocument;
  if (!s.replacement) return next;
  if (s.sectionId === 'summary' && s.type !== 'keyword') {
    next.summary = s.replacement;
  }
  if (s.sectionId === 'skills') {
    const parts = s.replacement.split(/[·,]/).map(x => x.trim()).filter(Boolean);
    next.skills = Array.from(new Set([...next.skills, ...parts]));
  }
  if (s.sectionId === 'experience' && s.targetPath?.startsWith('experience.0.bullets')) {
    const idx = parseInt(s.targetPath.split('.').pop() || '0', 10);
    if (next.experience[0]?.bullets[idx] !== undefined) {
      next.experience[0].bullets[idx] = s.replacement;
    }
  }
  return next;
}

export const defaultSectionOrder: SectionId[] = [
  'summary',
  'experience',
  'skills',
  'projects',
  'education',
  'certifications',
  'achievements',
];
