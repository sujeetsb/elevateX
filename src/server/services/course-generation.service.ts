import { z } from 'zod';
import { CourseDifficulty, LessonType } from '@prisma/client';
import { prisma } from '@/server/db/prisma';
import { generateJsonText } from '@/server/ai/gemini';
import { courseGenerateSystem, promptKeys, PROMPT_VERSION } from '@/server/ai/prompts/registry';
import { logger } from '@/server/logger';
import { enrollUserInCourse } from '@/server/services/course.service';

const lessonSchema = z.object({
  title: z.string().min(1),
  type: z.enum(['video', 'reading', 'quiz', 'project']),
  duration: z.string().default('15 min'),
  content: z.string().default(''),
  assignment: z.string().nullable().optional(),
  projectBrief: z.string().nullable().optional(),
  xpReward: z.number().int().default(80),
  quiz: z
    .object({
      questions: z.array(
        z.object({
          question: z.string(),
          options: z.array(z.string()).min(2),
          correctIndex: z.number().int().nonnegative(),
        }),
      ),
    })
    .nullable()
    .optional(),
});

const moduleSchema = z.object({
  title: z.string().min(1),
  description: z.string().default(''),
  subtopics: z.array(z.string()).default([]),
  xpReward: z.number().int().default(200),
  locked: z.boolean().default(false),
  lessons: z.array(lessonSchema).min(1),
});

const courseAiSchema = z.object({
  title: z.string().min(1),
  description: z.string().default(''),
  difficulty: z.enum(['Beginner', 'Intermediate', 'Advanced']).default('Intermediate'),
  estimatedDays: z.number().int().min(7).max(90).default(30),
  totalXp: z.number().int().min(800).max(5000).default(1500),
  tags: z.array(z.string()).default([]),
  expectedOutcomes: z.array(z.string()).default([]),
  timeline: z
    .array(z.object({ week: z.number(), focus: z.string(), deliverables: z.array(z.string()) }))
    .default([]),
  modules: z.array(moduleSchema).min(1),
});

export type CourseGenerateInput = {
  userId: string;
  title?: string;
  goals?: string[];
  skillLevel?: string;
  durationDays?: number;
  learningStyle?: string;
};

function mapDifficulty(d: string): CourseDifficulty {
  if (d === 'Beginner') return 'BEGINNER';
  if (d === 'Advanced') return 'ADVANCED';
  return 'INTERMEDIATE';
}

function mapLessonType(t: string): LessonType {
  if (t === 'video') return 'VIDEO';
  if (t === 'quiz') return 'QUIZ';
  if (t === 'project') return 'PROJECT';
  return 'READING';
}

async function loadUserContext(userId: string) {
  const [profile, skills, resume, roadmap] = await Promise.all([
    prisma.profile.findUnique({ where: { userId } }),
    prisma.userSkill.findMany({ where: { userId }, include: { skill: true }, take: 24 }),
    prisma.resume.findFirst({
      where: { userId, deletedAt: null, parseStatus: 'COMPLETE' },
      orderBy: { updatedAt: 'desc' },
      select: { parsedJson: true, atsScore: true },
    }),
    prisma.learningRoadmap.findFirst({
      where: { userId, status: 'ACTIVE', deletedAt: null },
      orderBy: { updatedAt: 'desc' },
      select: { jsonPlan: true, title: true },
    }),
  ]);

  const parsed = resume?.parsedJson as { gaps?: string[]; strengths?: string[] } | null;
  return {
    profile,
    skillLabels: skills.map(s => s.skill.label),
    weakAreas: parsed?.gaps ?? [],
    resumeAnalysis: {
      atsScore: resume?.atsScore ?? null,
      strengths: parsed?.strengths ?? [],
    },
    careerPath: roadmap?.jsonPlan ?? null,
  };
}

function fallbackCourse(input: CourseGenerateInput, ctx: Awaited<ReturnType<typeof loadUserContext>>) {
  const target = ctx.profile?.targetRole ?? 'your target role';
  const title = input.title?.trim() || `Path to ${target}`;
  return courseAiSchema.parse({
    title,
    description: `Personalized course to help you grow toward ${target}.`,
    difficulty: input.skillLevel ?? 'Intermediate',
    estimatedDays: input.durationDays ?? 30,
    totalXp: 1500,
    tags: input.goals?.slice(0, 4) ?? ctx.skillLabels.slice(0, 4),
    expectedOutcomes: [
      `Understand core concepts for ${target}`,
      'Complete hands-on projects',
      'Pass knowledge checks',
    ],
    timeline: [{ week: 1, focus: 'Foundations', deliverables: ['Complete Module 1'] }],
    modules: [
      {
        title: 'Module 1: Foundations',
        description: 'Core concepts and setup',
        subtopics: ['Basics', 'Key terminology'],
        xpReward: 300,
        locked: false,
        lessons: [
          {
            title: 'Introduction',
            type: 'reading',
            duration: '15 min',
            content: `Welcome to your personalized path toward ${target}.`,
            xpReward: 80,
          },
          {
            title: 'Knowledge Check',
            type: 'quiz',
            duration: '10 min',
            content: 'Test your understanding.',
            xpReward: 100,
            quiz: {
              questions: [
                {
                  question: 'What is the primary goal of this course?',
                  options: [`Grow toward ${target}`, 'Unrelated topic', 'General trivia'],
                  correctIndex: 0,
                },
              ],
            },
          },
        ],
      },
    ],
  });
}


/** Cap AI output so Neon persist stays fast and reliable. */
function trimCourseAiData(data: z.infer<typeof courseAiSchema>) {
  return {
    ...data,
    modules: data.modules.slice(0, 4).map(mod => ({
      ...mod,
      lessons: mod.lessons.slice(0, 6),
    })),
  };
}

/** Persist course tree without a long interactive transaction (avoids Neon P2028). */
async function persistCourseTree(
  userId: string,
  input: CourseGenerateInput,
  aiData: z.infer<typeof courseAiSchema>,
) {
  const trimmed = trimCourseAiData(aiData);

  try {
    return await prisma.course.create({
      data: {
        userId,
        title: input.title?.trim() || trimmed.title,
        description: trimmed.description,
        difficulty: mapDifficulty(trimmed.difficulty),
        estimatedDays: input.durationDays ?? trimmed.estimatedDays,
        totalXp: trimmed.totalXp,
        tags: input.goals?.length ? input.goals.slice(0, 6) : trimmed.tags,
        expectedOutcomes: trimmed.expectedOutcomes,
        timeline: trimmed.timeline as object,
        aiGenerated: true,
        metadata: { learningStyle: input.learningStyle ?? 'Mixed' },
        modules: {
          create: trimmed.modules.map((mod, mi) => ({
            orderIndex: mi,
            title: mod.title,
            description: mod.description,
            subtopics: mod.subtopics,
            xpReward: mod.xpReward,
            locked: mi === 0 ? false : mod.locked,
            lessons: {
              create: mod.lessons.map((les, li) => ({
                orderIndex: li,
                title: les.title,
                content: les.content?.slice(0, 12_000) ?? '',
                duration: les.duration,
                type: mapLessonType(les.type),
                xpReward: les.xpReward,
                assignment: les.assignment ?? null,
                projectBrief: les.projectBrief ?? null,
                ...(les.quiz?.questions?.length
                  ? {
                      quiz: {
                        create: {
                          questions: les.quiz.questions as object,
                          passingScore: 70,
                        },
                      },
                    }
                  : {}),
              })),
            },
          })),
        },
        enrollments: {
          create: {
            userId,
            status: 'ACTIVE',
            progressPct: 0,
          },
        },
      },
    });
  } catch (e) {
    logger.error('course.persist_failed', { userId, error: String(e) });
    throw e;
  }
}

export async function generateAndPersistCourse(input: CourseGenerateInput) {
  const ctx = await loadUserContext(input.userId);

  const hashInput = [
    input.title ?? '',
    input.goals?.join(',') ?? '',
    input.skillLevel ?? '',
    String(input.durationDays ?? 30),
    ctx.profile?.targetRole ?? '',
    ctx.skillLabels.join(','),
  ].join('|');
  const cacheKey = `course-gen:${input.userId}:${Buffer.from(hashInput).toString('base64').slice(0, 48)}`;

  const existing = await prisma.cachedAiResponse.findUnique({ where: { cacheKey } });
  if (existing && existing.expiresAt > new Date()) {
    const cached = courseAiSchema.safeParse(existing.response);
    if (cached.success) {
      const courseId = (existing.response as { courseId?: string }).courseId;
      if (courseId) {
        const course = await prisma.course.findFirst({
          where: { id: courseId, deletedAt: null },
          include: { modules: { include: { lessons: { include: { quiz: true } } }, orderBy: { orderIndex: 'asc' } } },
        });
        if (course) {
          await enrollUserInCourse(input.userId, course.id);
          return { course, cached: true };
        }
        // Stale cache entry — course was deleted or never committed
        await prisma.cachedAiResponse.delete({ where: { cacheKey } }).catch(() => undefined);
      }
    }
  }

  let aiData: z.infer<typeof courseAiSchema>;
  try {
    const userPayload = JSON.stringify({
      requestedTitle: input.title,
      goals: input.goals,
      skillLevel: input.skillLevel,
      durationDays: input.durationDays,
      learningStyle: input.learningStyle,
      currentRole: ctx.profile?.currentRole,
      targetRole: ctx.profile?.targetRole,
      experienceYears: ctx.profile?.experienceYears,
      careerGoal: ctx.profile?.careerGoal,
      skills: ctx.skillLabels,
      weakAreas: ctx.weakAreas,
      resumeAnalysis: ctx.resumeAnalysis,
      careerPath: ctx.careerPath,
    });

    const { text, model } = await generateJsonText({
      system: courseGenerateSystem(),
      user: userPayload,
      quality: 'balanced',
      maxOutputTokens: 4096,
    });

    const parsed = courseAiSchema.safeParse(JSON.parse(text));
    aiData = parsed.success ? parsed.data : fallbackCourse(input, ctx);

    await prisma.cachedAiResponse.upsert({
      where: { cacheKey },
      create: {
        userId: input.userId,
        cacheKey,
        promptKey: promptKeys.courseGenerate ?? 'course.generate',
        promptVer: PROMPT_VERSION,
        model,
        response: aiData as object,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
      update: {
        response: aiData as object,
        model,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });
  } catch (e) {
    logger.warn('course.generate.ai_failed', { error: String(e) });
    aiData = fallbackCourse(input, ctx);
  }

  const created = await persistCourseTree(input.userId, input, aiData);

  const full = await prisma.course.findFirst({
    where: { id: created.id, deletedAt: null },
    include: {
      modules: {
        orderBy: { orderIndex: 'asc' },
        include: {
          lessons: {
            orderBy: { orderIndex: 'asc' },
            include: { quiz: true },
          },
        },
      },
      enrollments: { where: { userId: input.userId } },
    },
  });

  if (!full) {
    throw new Error('Course was created but could not be loaded');
  }

  await prisma.cachedAiResponse.upsert({
    where: { cacheKey },
    create: {
      userId: input.userId,
      cacheKey,
      promptKey: promptKeys.courseGenerate ?? 'course.generate',
      promptVer: PROMPT_VERSION,
      model: 'persisted',
      response: { ...(aiData as object), courseId: created.id } as object,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
    update: {
      response: { ...(aiData as object), courseId: created.id } as object,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  return { course: full, cached: false };
}
