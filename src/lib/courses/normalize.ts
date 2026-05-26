import type { Course, Module, Lesson } from '@/components/GameContext';

function normalizeLesson(l: Partial<Lesson>): Lesson {
  const quiz = Array.isArray(l.quiz)
    ? l.quiz
      .map(q => {
        const qObj = q as { question?: string; options?: string[]; correctIndex?: number };
        if (!qObj?.question || !Array.isArray(qObj.options) || qObj.options.length < 2) return null;
        return {
          question: qObj.question,
          options: qObj.options.map(String),
          correctIndex: Number.isInteger(qObj.correctIndex) ? (qObj.correctIndex as number) : 0,
          difficulty: typeof (q as { difficulty?: unknown }).difficulty === 'string'
            ? (q as { difficulty: string }).difficulty
            : undefined,
        };
      })
      .filter(Boolean) as Lesson['quiz']
    : undefined;
  return {
    id: l.id ?? '',
    title: l.title ?? 'Lesson',
    duration: l.duration ?? '15 min',
    type: l.type ?? 'reading',
    completed: Boolean(l.completed),
    content: typeof l.content === 'string' ? l.content : undefined,
    quiz,
  };
}

function normalizeModule(m: Partial<Module>): Module {
  const lessons = Array.isArray(m.lessons) ? m.lessons.map(normalizeLesson) : [];
  return {
    id: m.id ?? '',
    title: m.title ?? 'Module',
    description: m.description ?? '',
    locked: Boolean(m.locked),
    completed: Boolean(m.completed),
    xpReward: m.xpReward ?? 200,
    lessons,
  };
}

/** Ensures course shape is safe for UI — prevents crashes when modules/tags missing. */
export function normalizeCourse(raw: Partial<Course> | null | undefined): Course | null {
  if (!raw?.id) return null;
  const modules = Array.isArray(raw.modules) ? raw.modules.map(normalizeModule) : [];
  return {
    id: raw.id,
    title: raw.title ?? 'Untitled course',
    description: raw.description ?? '',
    category: raw.category ?? 'General',
    difficulty: raw.difficulty ?? 'Intermediate',
    estimatedDays: raw.estimatedDays ?? 14,
    totalXp: raw.totalXp ?? 500,
    progress: raw.progress ?? 0,
    modules,
    thumbnail: raw.thumbnail ?? '📚',
    tags: Array.isArray(raw.tags) ? raw.tags : [],
    aiGenerated: raw.aiGenerated ?? false,
  };
}
