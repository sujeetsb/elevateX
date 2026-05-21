import type { ResumeTemplateId } from './types';

export interface ResumeTemplateMeta {
  id: ResumeTemplateId;
  name: string;
  tagline: string;
  category: 'Minimal' | 'Modern' | 'Corporate' | 'Creative' | 'Tech' | 'Executive' | 'Student';
  /** CSS variables for preview chrome */
  accent: string;
  muted: string;
  fontHeading: string;
  fontBody: string;
  density: 'compact' | 'comfortable' | 'spacious';
  layout: 'single' | 'two-column';
}

export const RESUME_TEMPLATES: ResumeTemplateMeta[] = [
  {
    id: 'minimal',
    name: 'Minimal',
    tagline: 'Clean whitespace, single column, maximum clarity',
    category: 'Minimal',
    accent: '#0f172a',
    muted: '#64748b',
    fontHeading: "'Space Grotesk', sans-serif",
    fontBody: "'Inter', system-ui, sans-serif",
    density: 'spacious',
    layout: 'single',
  },
  {
    id: 'modern-saas',
    name: 'Modern SaaS',
    tagline: 'Product-led layout with accent rails',
    category: 'Modern',
    accent: '#7c3aed',
    muted: '#94a3b8',
    fontHeading: "'Space Grotesk', sans-serif",
    fontBody: "'Space Grotesk', sans-serif",
    density: 'comfortable',
    layout: 'single',
  },
  {
    id: 'corporate',
    name: 'Corporate Professional',
    tagline: 'Traditional hierarchy, serif headings',
    category: 'Corporate',
    accent: '#1e3a5f',
    muted: '#475569',
    fontHeading: "'Georgia', serif",
    fontBody: "'Inter', system-ui, sans-serif",
    density: 'compact',
    layout: 'single',
  },
  {
    id: 'creative',
    name: 'Creative',
    tagline: 'Bold accent blocks for portfolios',
    category: 'Creative',
    accent: '#db2777',
    muted: '#9d174d',
    fontHeading: "'Space Grotesk', sans-serif",
    fontBody: "'Inter', sans-serif",
    density: 'comfortable',
    layout: 'two-column',
  },
  {
    id: 'developer',
    name: 'Developer / Tech',
    tagline: 'Skills-forward, monospace accents',
    category: 'Tech',
    accent: '#059669',
    muted: '#047857',
    fontHeading: "'Space Grotesk', sans-serif",
    fontBody: "'IBM Plex Mono', ui-monospace, monospace",
    density: 'compact',
    layout: 'two-column',
  },
  {
    id: 'executive',
    name: 'Executive',
    tagline: 'Board-ready, impact metrics first',
    category: 'Executive',
    accent: '#b45309',
    muted: '#92400e',
    fontHeading: "'Georgia', serif",
    fontBody: "'Inter', sans-serif",
    density: 'spacious',
    layout: 'single',
  },
  {
    id: 'fresher',
    name: 'Fresher / Student',
    tagline: 'Education-first, projects highlighted',
    category: 'Student',
    accent: '#2563eb',
    muted: '#1d4ed8',
    fontHeading: "'Space Grotesk', sans-serif",
    fontBody: "'Inter', sans-serif",
    density: 'comfortable',
    layout: 'single',
  },
];

export function getTemplateMeta(id: ResumeTemplateId): ResumeTemplateMeta {
  return RESUME_TEMPLATES.find(t => t.id === id) ?? RESUME_TEMPLATES[1];
}
