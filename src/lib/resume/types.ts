export type SectionId =
  | 'summary'
  | 'experience'
  | 'skills'
  | 'education'
  | 'projects'
  | 'certifications'
  | 'achievements';

export interface PersonalInfo {
  fullName: string;
  email: string;
  phone: string;
  location: string;
  linkedIn?: string;
  portfolio?: string;
  headline?: string;
}

export interface ExperienceEntry {
  id: string;
  company: string;
  role: string;
  location?: string;
  start: string;
  end: string;
  bullets: string[];
}

export interface EducationEntry {
  id: string;
  school: string;
  degree: string;
  start: string;
  end: string;
  notes?: string;
}

export interface ProjectEntry {
  id: string;
  name: string;
  description: string;
  tech: string[];
}

export interface CertificationEntry {
  id: string;
  name: string;
  issuer: string;
  date: string;
}

export interface ResumeDocument {
  personal: PersonalInfo;
  summary: string;
  experience: ExperienceEntry[];
  skills: string[];
  education: EducationEntry[];
  projects: ProjectEntry[];
  certifications: CertificationEntry[];
  achievements: string[];
  /** Order of main sections (personal always rendered first). */
  sectionOrder: SectionId[];
}

export type ResumeTemplateId =
  | 'minimal'
  | 'modern-saas'
  | 'corporate'
  | 'creative'
  | 'developer'
  | 'executive'
  | 'fresher';

export type AISuggestionType =
  | 'bullet'
  | 'keyword'
  | 'grammar'
  | 'readability'
  | 'actionVerb'
  | 'industry'
  | 'recruiter';

export interface AISuggestion {
  id: string;
  type: AISuggestionType;
  sectionId: SectionId;
  title: string;
  detail: string;
  /** Plain-text replacement or addition. */
  replacement?: string;
  /** Dot path for targeting e.g. experience.0.bullets.1 */
  targetPath?: string;
  status: 'pending' | 'accepted' | 'rejected';
}

export type WizardStep =
  | 'upload'
  | 'analyzing'
  | 'ats'
  | 'improvements'
  | 'template'
  | 'optimize-mode'
  | 'ai-processing'
  | 'editor'
  | 'export';

export type OptimizeMode = 'polish' | 'rewrite' | 'generate';

export interface SavedResumeMeta {
  id: string;
  name: string;
  templateId: ResumeTemplateId;
  atsScoreSnapshot: number;
  updatedAt: string;
  document: ResumeDocument;
}

export interface OptimizationHistoryEntry {
  id: string;
  label: string;
  atsBefore: number;
  atsAfter: number;
  templateId: ResumeTemplateId;
  createdAt: string;
}

export interface ResumeLibraryState {
  saved: SavedResumeMeta[];
  history: OptimizationHistoryEntry[];
  templateUsage: Record<ResumeTemplateId, number>;
}
