import { z } from 'zod';

// ---------------------------------------------------------------------------
// Resume analysis schemas
// ---------------------------------------------------------------------------

export const resumeAnalyzeResultSchema = z.object({
  atsScore: z.coerce.number().min(0).max(100),
  summary: z.string(),
  skills: z.array(z.string()),
  gaps: z.array(z.string()),
  bullets: z.array(z.string()),
});

const personalSchema = z.object({
  fullName:  z.string().optional().nullable(),
  email:     z.string().optional().nullable(),
  phone:     z.string().optional().nullable(),
  location:  z.string().optional().nullable(),
  linkedIn:  z.string().optional().nullable(),
  github:    z.string().optional().nullable(),
  portfolio: z.string().optional().nullable(),
  website:   z.string().optional().nullable(),
});

export const resumePersonalPartialSchema = personalSchema.partial();

const experienceItemSchema = z.object({
  title:              z.string().optional().nullable(),
  role:               z.string().optional().nullable(),
  company:            z.string().optional().nullable(),
  employmentType:     z.string().optional().nullable(),
  location:           z.string().optional().nullable(),
  start:              z.string().optional().nullable(),
  end:                z.string().optional().nullable(),
  startDate:          z.string().optional().nullable(),
  endDate:            z.string().optional().nullable(),
  currentlyWorking:   z.coerce.boolean().optional().nullable(),
  bullets:            z.array(z.string()).default([]),
  responsibilities:   z.array(z.string()).optional().default([]),
  achievements:       z.array(z.string()).optional().default([]),
  quantifiedImpact:   z.array(z.string()).optional().default([]),
  technologiesUsed:   z.array(z.string()).optional().default([]),
});

const educationItemSchema = z.object({
  school:         z.string().optional().nullable(),
  institution:    z.string().optional().nullable(),
  degree:         z.string().optional().nullable(),
  specialization: z.string().optional().nullable(),
  years:          z.string().optional().nullable(),
  grade:          z.string().optional().nullable(),
  startYear:      z.coerce.number().optional().nullable(),
  endYear:        z.coerce.number().optional().nullable(),
});

export const resumeExperienceArraySchema = z.array(experienceItemSchema);
export const resumeEducationArraySchema  = z.array(educationItemSchema);

function dedupeStrList(xs: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const x of xs) {
    const t = x.trim();
    if (!t) continue;
    const k = t.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(t);
  }
  return out;
}

const projectItemSchema = z
  .object({
    name:         z.string().optional().nullable(),
    title:        z.string().optional().nullable(),
    description:  z.string().optional().nullable(),
    tech:         z.array(z.string()).optional().default([]),
    technologies: z.array(z.string()).optional().default([]),
    role:         z.string().optional().nullable(),
    duration:     z.string().optional().nullable(),
    impact:       z.string().optional().nullable(),
    projectLinks: z.array(z.string()).optional().default([]),
  })
  .transform(p => ({
    ...p,
    name: (p.name?.trim() || p.title?.trim() || 'Project').slice(0, 200),
    tech: dedupeStrList([...(p.tech ?? []), ...(p.technologies ?? [])]),
    technologies: p.technologies ?? [],
  }));

export const resumeProjectsArraySchema = z.array(projectItemSchema);

// ---------------------------------------------------------------------------
// ATS analyzer section + report schemas (from AiResumeAnalyzerAgent)
// ---------------------------------------------------------------------------

export const resumeAnalyzerSectionSchema = z.object({
  score:   z.coerce.number().min(0).max(100),
  comment: z.string().optional().nullable(),
});

export type ResumeAnalyzerSectionScore = z.infer<typeof resumeAnalyzerSectionSchema>;

export const resumeAnalyzerReportSchema = z.object({
  overall_score:    z.coerce.number().min(0).max(100),
  overall_feedback: z.string().optional().nullable(),
  summary_comment:  z.string().optional().nullable(),
  sections: z
    .object({
      contact_info: resumeAnalyzerSectionSchema.optional(),
      experience:   resumeAnalyzerSectionSchema.optional(),
      education:    resumeAnalyzerSectionSchema.optional(),
      skills:       resumeAnalyzerSectionSchema.optional(),
    })
    .optional(),
  tips_for_improvement: z.array(z.string()).default([]),
  whats_good:           z.array(z.string()).default([]),
  needs_improvement:    z.array(z.string()).default([]),
});

export type ResumeAnalyzerReport = z.infer<typeof resumeAnalyzerReportSchema>;

// ---------------------------------------------------------------------------
// Deep ATS analysis schema (rich, personalized)
// ---------------------------------------------------------------------------

const atsDeepSectionSchema = z.object({
  score:       z.coerce.number().min(0).max(100),
  comment:     z.string().optional().nullable(),
  issues:      z.array(z.string()).default([]),
  strongPoints: z.array(z.string()).optional().default([]),
  missing:     z.array(z.string()).optional().default([]),
  present:     z.array(z.string()).optional().default([]),
  matched:     z.array(z.string()).optional().default([]),
});

export const atsDeepAnalysisSchema = z.object({
  atsScore: z.coerce.number().min(0).max(100),
  grade:    z.string().optional().nullable(),
  summary:  z.string().optional().nullable(),
  sections: z
    .object({
      contact_info:    atsDeepSectionSchema.optional(),
      summary_section: atsDeepSectionSchema.optional(),
      experience:      atsDeepSectionSchema.optional(),
      education:       atsDeepSectionSchema.optional(),
      skills:          atsDeepSectionSchema.optional(),
      keywords:        atsDeepSectionSchema.optional(),
      formatting:      atsDeepSectionSchema.optional(),
      impact:          atsDeepSectionSchema.optional(),
    })
    .optional(),
  topImprovements: z
    .array(
      z.object({
        priority:       z.string(),
        action:         z.string(),
        expectedImpact: z.string().optional().nullable(),
        section:        z.string().optional().nullable(),
      }),
    )
    .default([]),
  strengths:          z.array(z.string()).default([]),
  keywordGaps:        z.array(z.string()).default([]),
  industryBenchmark:  z.object({ percentile: z.coerce.number().optional(), comment: z.string().optional() }).optional(),
});

export type AtsDeepAnalysis = z.infer<typeof atsDeepAnalysisSchema>;

// ---------------------------------------------------------------------------
// Full resume intelligence (persisted to DB + profile sync)
// ---------------------------------------------------------------------------

export const resumeIntelligenceSchema = z.object({
  personal:                   resumePersonalPartialSchema.default({}),
  summary:                    z.string().optional().nullable(),
  headline:                   z.string().optional().nullable(),
  careerObjective:            z.string().optional().nullable(),
  skills:                     z.array(z.string()).default([]),
  technicalSkills:            z.array(z.string()).default([]),
  tools:                      z.array(z.string()).default([]),
  platforms:                  z.array(z.string()).default([]),
  languages:                  z.array(z.string()).default([]),
  gaps:                       z.array(z.string()).default([]),
  strengths:                  z.array(z.string()).default([]),
  experience:                 z.array(experienceItemSchema).default([]),
  education:                  z.array(educationItemSchema).default([]),
  certifications:             z.array(z.string()).default([]),
  projects:                   z.array(projectItemSchema).default([]),
  softSkills:                 z.array(z.string()).default([]),
  domainExpertise:            z.array(z.string()).default([]),
  industriesSuggested:        z.array(z.string()).default([]),
  targetRolesSuggested:       z.array(z.string()).default([]),
  yearsOfExperienceApprox:    z.coerce.number().optional().nullable(),
  careerLevel:                z.string().optional().nullable(),
  atsScore:                   z.coerce.number().min(0).max(100),
  confidence:                 z.record(z.number()).optional(),
  awards:                     z.array(z.string()).default([]),
  publications:               z.array(z.string()).default([]),
  volunteering:               z.array(z.string()).default([]),
  leadership:                 z.array(z.string()).default([]),
  interests:                  z.array(z.string()).default([]),
  extracurricularActivities:  z.array(z.string()).default([]),
  /** Structured analyzer report aligned with AiResumeAnalyzerAgent UI schema. */
  analyzerReport:             resumeAnalyzerReportSchema.partial().optional(),
  /** Deep ATS analysis (populated by dedicated ATS analysis job). */
  atsDeepAnalysis:            atsDeepAnalysisSchema.partial().optional(),
});

export type ResumeIntelligence = z.infer<typeof resumeIntelligenceSchema>;

/**
 * Loose Gemini payload — passthrough so malformed nested arrays don't discard entire payload.
 * normalizeGeminiResumeMerge picks safely from this.
 */
export const geminiResumeMergedResponseSchema = z
  .object({
    overall_score:    z.coerce.number().min(0).max(100).optional(),
    overall_feedback: z.string().optional().nullable(),
    summary_comment:  z.string().optional().nullable(),
    sections: z
      .object({
        contact_info: resumeAnalyzerSectionSchema.partial().optional(),
        experience:   resumeAnalyzerSectionSchema.partial().optional(),
        education:    resumeAnalyzerSectionSchema.partial().optional(),
        skills:       resumeAnalyzerSectionSchema.partial().optional(),
      })
      .passthrough()
      .optional(),
    tips_for_improvement: z.array(z.string()).optional(),
    whats_good:           z.array(z.string()).optional(),
    needs_improvement:    z.array(z.string()).optional(),
  })
  .passthrough();

export type GeminiResumeMergedResponse = z.infer<typeof geminiResumeMergedResponseSchema> &
  Partial<z.infer<typeof resumeIntelligenceSchema>>;

// ---------------------------------------------------------------------------
// Job match schema
// ---------------------------------------------------------------------------

export const jobRankResultSchema = z.object({
  ranked: z.array(
    z.object({
      id:            z.string(),
      score:         z.number().min(0).max(100),
      reason:        z.string(),
      matchedSkills: z.array(z.string()).optional().default([]),
      missingSkills: z.array(z.string()).optional().default([]),
    }),
  ),
});

// ---------------------------------------------------------------------------
// Learning roadmap schema (rich, multi-domain)
// ---------------------------------------------------------------------------

const roadmapResourceSchema = z.object({
  title:    z.string(),
  url:      z.string().min(4),
  provider: z.string(),
  kind:     z.string().optional(),
});

const roadmapModuleSchema = z.object({
  title:     z.string(),
  summary:   z.string().optional(),
  resources: z.array(roadmapResourceSchema),
});

export const learningRoadmapResultSchema = z.object({
  title:    z.string(),
  subtitle: z.string().optional(),
  weeks:    z.number().optional(),
  audience: z.string().optional(),
  stages: z
    .array(
      z.object({
        title:          z.string(),
        summary:        z.string().optional(),
        timeframeWeeks: z.number().optional(),
      }),
    )
    .optional(),
  milestones:    z.array(z.string()).optional(),
  certifications: z
    .array(
      z.object({
        title:  z.string(),
        issuer: z.string().optional(),
        url:    z.string().optional(),
      }),
    )
    .optional(),
  projectIdeas:  z.array(z.string()).optional(),
  industryNotes: z.string().optional(),
  modules:       z.array(roadmapModuleSchema),
});

export type LearningRoadmapResult = z.infer<typeof learningRoadmapResultSchema>;

// ---------------------------------------------------------------------------
// Course recommendation schema
// ---------------------------------------------------------------------------

const courseRecommendationItemSchema = z.object({
  title:           z.string(),
  provider:        z.string(),
  url:             z.string().min(4),
  kind:            z.string().optional(),
  difficulty:      z.string().optional(),
  estimatedHours:  z.coerce.number().optional().nullable(),
  whyRecommended:  z.string().optional().nullable(),
  skillsCovered:   z.array(z.string()).default([]),
  priority:        z.string().optional(),
});

export const courseRecommendResultSchema = z.object({
  recommendations: z.array(courseRecommendationItemSchema),
});

export type CourseRecommendResult = z.infer<typeof courseRecommendResultSchema>;
