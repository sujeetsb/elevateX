import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/server/db/prisma';
import { getSession } from '@/server/http/get-session';
import { handleApiError } from '@/server/errors/handler';
import { unauthorized, notFound } from '@/server/errors/http-error';
import { generateJsonText } from '@/server/ai/gemini';

export const dynamic = 'force-dynamic';

const quizQuestionSchema = z.object({
  lessonId: z.string().min(1),
  question: z.string().min(8),
  options: z.array(z.string().min(1)).min(3).max(5),
  correctIndex: z.number().int().min(0).max(4),
  difficulty: z.enum(['easy', 'medium', 'hard']).default('medium'),
});

type QuizQuestion = z.infer<typeof quizQuestionSchema>;

function fallbackQuestions(course: {
  modules: Array<{ lessons: Array<{ id: string; title: string; content: string | null }> }>;
}): QuizQuestion[] {
  const lessons = course.modules.flatMap(m => m.lessons).slice(0, 8);
  return lessons.map((lesson) => ({
    lessonId: lesson.id,
    question: `Which statement best summarizes "${lesson.title}"?`,
    options: [
      'It focuses on practical implementation and outcomes.',
      'It is unrelated to the learning objective.',
      'It only covers historical background.',
      'It should be skipped for this course path.',
    ],
    correctIndex: 0,
    difficulty: 'medium',
  }));
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSession();
    if (!session?.user?.id) throw unauthorized();
    const { id: courseId } = await ctx.params;
    const lessonId = new URL(req.url).searchParams.get('lessonId')?.trim() || '';

    const enrollment = await prisma.userCourse.findUnique({
      where: { userId_courseId: { userId: session.user.id, courseId } },
      select: { progressPct: true, lastAccessedAt: true },
    });
    const course = await prisma.course.findFirst({
      where: { id: courseId, deletedAt: null },
      select: {
        id: true,
        title: true,
        description: true,
        updatedAt: true,
        modules: {
          orderBy: { orderIndex: 'asc' },
          select: {
            lessons: {
              orderBy: { orderIndex: 'asc' },
              select: { id: true, title: true, content: true },
            },
          },
        },
      },
    });
    if (!course) throw notFound('Course not found');

    const key = `course-quiz:${session.user.id}:${courseId}:${enrollment?.progressPct ?? 0}:${course.updatedAt.getTime()}`;
    const cached = await prisma.cachedAiResponse.findUnique({ where: { cacheKey: key } });
    if (cached?.response) {
      const cachedQuestions = Array.isArray((cached.response as Record<string, unknown>)?.questions)
        ? ((cached.response as { questions: unknown[] }).questions
          .map(q => quizQuestionSchema.safeParse(q))
          .filter(r => r.success)
          .map(r => r.data))
        : [];
      const filtered = lessonId ? cachedQuestions.filter(q => q.lessonId === lessonId) : cachedQuestions;
      if (filtered.length > 0) {
        return NextResponse.json({ ok: true, data: { questions: filtered, cached: true } });
      }
    }

    let questions: QuizQuestion[] = [];
    try {
      const lessonContext = course.modules
        .flatMap(m => m.lessons)
        .slice(0, 16)
        .map(l => `- ${l.id}: ${l.title}${l.content ? ` (${l.content.slice(0, 200)})` : ''}`)
        .join('\n');
      const { text } = await generateJsonText({
        quality: 'balanced',
        system: 'You are a course assessment engine. Return valid JSON only.',
        user: [
          `Course: ${course.title}`,
          `Description: ${course.description.slice(0, 800)}`,
          `User progress: ${enrollment?.progressPct ?? 0}%`,
          `Lessons:`,
          lessonContext,
          '',
          'Return JSON:',
          '{ "questions": [{ "lessonId":"...", "question":"...", "options":["...","...","...","..."], "correctIndex":0, "difficulty":"easy|medium|hard" }] }',
          'Generate one MCQ per lesson id included above, max 8 questions.',
        ].join('\n'),
        maxOutputTokens: 1500,
      });
      const raw = JSON.parse(text) as { questions?: unknown[] };
      questions = Array.isArray(raw.questions)
        ? raw.questions
          .map(q => quizQuestionSchema.safeParse(q))
          .filter(r => r.success)
          .map(r => r.data)
        : [];
    } catch {
      questions = [];
    }

    if (questions.length === 0) {
      questions = fallbackQuestions(course);
    }

    const payload = { questions };
    await prisma.cachedAiResponse.upsert({
      where: { cacheKey: key },
      create: {
        cacheKey: key,
        promptKey: 'course.quiz.dynamic',
        promptVer: '1',
        model: 'gemini',
        response: payload,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        userId: session.user.id,
      },
      update: {
        response: payload,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    const filtered = lessonId ? questions.filter(q => q.lessonId === lessonId) : questions;
    return NextResponse.json({ ok: true, data: { questions: filtered, cached: false } });
  } catch (e) {
    return handleApiError(e);
  }
}
