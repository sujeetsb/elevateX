'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Lock, Check, Play, BookOpen, HelpCircle, Hammer, Zap, ChevronDown, ChevronUp, Trophy } from 'lucide-react';
import { useGame } from '../components/GameContext';
import { CareerDialog } from '../components/CareerDialog';
import { DialogTitle } from '../components/ui/dialog';

const lessonIcons: Record<string, ReactNode> = {
  video: <Play size={14} />,
  reading: <BookOpen size={14} />,
  quiz: <HelpCircle size={14} />,
  project: <Hammer size={14} />,
};

const lessonColors: Record<string, string> = {
  video: '#7c3aed',
  reading: '#06b6d4',
  quiz: '#f59e0b',
  project: '#10b981',
};

const mockLessonContent = `## Introduction to React Native Navigation

React Native navigation is fundamental to building production apps. In this lesson, we'll explore the Expo Router architecture.

### Key Concepts

**File-based Routing** — Expo Router uses a file-system based approach, similar to Next.js. Every file in the \`app\` directory becomes a route.

\`\`\`typescript
// app/index.tsx → renders at /
// app/profile.tsx → renders at /profile
// app/posts/[id].tsx → dynamic route
\`\`\`

### Stack Navigator

The Stack navigator provides a way to transition between screens where each new screen is placed on top of a stack:

\`\`\`typescript
import { Stack } from 'expo-router';

export default function Layout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: 'var(--cp-bg-base)' },
        headerTintColor: 'var(--cp-text-primary)',
      }}
    />
  );
}
\`\`\`

### Tab Navigation

For bottom tabs, use the Tabs layout:

\`\`\`typescript
import { Tabs } from 'expo-router';

export default function TabLayout() {
  return (
    <Tabs>
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}
\`\`\`

> **AI Insight:** Tab navigation combined with Stack navigation is the most common pattern in production React Native apps. Master this pattern to architect scalable apps.

### Practice Challenge

Build a simple app with:
1. A tab navigator with 3 tabs
2. Each tab has its own stack
3. Pass parameters between screens
`;

export function CourseDetail() {
  const params = useParams() ?? {};
  const rawId = params.id;
  const id = typeof rawId === 'string' ? rawId : Array.isArray(rawId) ? rawId[0] : undefined;
  const router = useRouter();
  const { courses, completeLesson } = useGame();
  const [expandedModule, setExpandedModule] = useState<string | null>(null);
  const [activeLesson, setActiveLesson] = useState<{ courseId: string; moduleId: string; lessonId: string } | null>(null);
  const [showQuiz, setShowQuiz] = useState(false);
  const [quizLessonTarget, setQuizLessonTarget] = useState<{ moduleId: string; lessonId: string } | null>(null);
  const [quizAnswer, setQuizAnswer] = useState<number | null>(null);
  const [quizSubmitted, setQuizSubmitted] = useState(false);

  const course = courses.find(c => c.id === id);

  useEffect(() => {
    if (!course) return;
    if (expandedModule) return;
    const firstModuleId = course.modules?.[0]?.id;
    if (firstModuleId) setExpandedModule(firstModuleId);
  }, [course, expandedModule]);

  const handleCompleteLesson = (moduleId: string, lessonId: string, xpReward = 80) => {
    if (!course) return;
    completeLesson(course.id, moduleId, lessonId, xpReward);
    setActiveLesson(null);

    // Auto-progression: after all lessons in this module complete, open next module after 1.5s
    const currentModule = course.modules.find(m => m.id === moduleId);
    if (!currentModule) return;

    const remainingLessons = currentModule.lessons.filter(l => l.id !== lessonId && !l.completed);
    if (remainingLessons.length === 0) {
      const currentIdx = course.modules.findIndex(m => m.id === moduleId);
      const nextModule = course.modules[currentIdx + 1];
      if (nextModule && !nextModule.locked) {
        setTimeout(() => {
          setExpandedModule(nextModule.id);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }, 1500);
      }
    }
  };

  if (!course) {
    return (
      <div className="app-page section-pad py-16 text-center" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
        <p style={{ color: 'var(--cp-text-muted)' }} className="mb-4">We could not find this course.</p>
        <button
          type="button"
          onClick={() => router.push('/app/courses')}
          className="btn-primary rounded-xl px-6 py-3"
        >
          Back to courses
        </button>
      </div>
    );
  }

  const completedLessons = course.modules.flatMap(m => m.lessons).filter(l => l.completed).length;
  const totalLessons = course.modules.flatMap(m => m.lessons).length;

  const activeLessonRow =
    activeLesson &&
    course.modules
      .find(m => m.id === activeLesson.moduleId)
      ?.lessons.find(l => l.id === activeLesson.lessonId);

  const quizOptions = [
    'Expo Router uses file-system based routing',
    'Expo Router uses class-based routing',
    'Expo Router only supports web navigation',
    'Expo Router requires manual route registration',
  ];

  return (
    <div className="app-page" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
      {/* Header */}
      <div className="flex items-center gap-3 section-pad pt-5 pb-4">
        <button
          onClick={() => router.push('/app/courses')}
          className="w-9 h-9 rounded-xl flex items-center justify-center glass-card"
        >
          <ArrowLeft size={18} color="#94a3b8" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="text-xs mb-0.5" style={{ color: 'var(--cp-text-muted)' }}>{course.category}</div>
          <div className="font-bold truncate" style={{ color: 'var(--cp-text-primary)', fontSize: '0.95rem' }}>{course.title}</div>
        </div>
        <div className="text-2xl">{course.thumbnail}</div>
      </div>

      {/* Course overview card */}
      <div className="section-pad mb-5">
        <div className="rounded-3xl p-5 relative overflow-hidden"
          style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.2), rgba(6,182,212,0.1))', border: '1px solid rgba(124,58,237,0.25)' }}>
          <div className="absolute top-0 right-0 w-24 h-24 rounded-full opacity-10"
            style={{ background: 'radial-gradient(circle, #a78bfa, transparent)', transform: 'translate(30%, -30%)' }} />

          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="level-badge rounded-md px-2 py-0.5">
                  <span style={{ color: 'var(--cp-text-inverse)', fontSize: '0.7rem', fontWeight: 700 }}>{course.difficulty}</span>
                </div>
                <span style={{ color: 'var(--cp-text-muted)', fontSize: '0.75rem' }}>{course.estimatedDays} days</span>
              </div>
              <div style={{ color: 'var(--cp-text-primary)', fontWeight: 700, fontSize: '1.1rem' }}>
                {completedLessons}/{totalLessons} Lessons
              </div>
            </div>
            <div className="text-right">
              <div className="flex items-center gap-1 justify-end mb-1">
                <Zap size={16} color="#f59e0b" />
                <span style={{ color: '#f59e0b', fontWeight: 700 }}>{course.totalXp} XP</span>
              </div>
              <div className="flex items-center gap-1 justify-end">
                <Trophy size={14} color="#a78bfa" />
                <span style={{ color: '#a78bfa', fontSize: '0.8rem' }}>Course Trophy</span>
              </div>
            </div>
          </div>

          <div className="rounded-full overflow-hidden mb-2" style={{ background: 'var(--cp-bg-elevated)', height: '8px' }}>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${course.progress}%` }}
              transition={{ duration: 1.5 }}
              style={{ height: '100%', borderRadius: '999px', background: 'linear-gradient(90deg, #7c3aed, #06b6d4)' }}
            />
          </div>
          <div style={{ color: 'var(--cp-text-muted)', fontSize: '0.72rem' }}>{course.progress}% complete</div>
        </div>
      </div>

      {/* Tags */}
      {course.tags.length > 0 && (
        <div className="section-pad mb-4">
          <div className="flex flex-wrap gap-2">
            {course.tags.map(tag => (
              <div key={tag} className="rounded-xl px-3 py-1.5"
                style={{ background: 'var(--cp-bg-card)', border: '1px solid var(--cp-border)', color: 'var(--cp-text-muted)', fontSize: '0.78rem' }}>
                {tag}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Module journey */}
      <div className="section-pad mb-6">
        <h3 style={{ color: 'var(--cp-text-primary)', fontWeight: 700, marginBottom: '12px' }}>Learning Journey</h3>
        <div className="space-y-3">
          {course.modules.map((mod, modIndex) => (
            <div key={mod.id}>
              {/* Module connector dots */}
              {modIndex > 0 && (
                <div className="flex justify-center my-2">
                  <div className="flex flex-col gap-1">
                    {[0, 1, 2].map(i => (
                      <div key={i} className="w-1.5 h-1.5 rounded-full"
                        style={{ background: mod.locked ? 'rgba(255,255,255,0.08)' : 'rgba(124,58,237,0.4)' }} />
                    ))}
                  </div>
                </div>
              )}

              {/* Module card */}
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: modIndex * 0.1 }}
                className="rounded-2xl overflow-hidden"
                style={{
                  background: mod.locked ? 'rgba(255,255,255,0.02)' : mod.completed ? 'rgba(16,185,129,0.08)' : 'rgba(124,58,237,0.08)',
                  border: mod.locked ? '1px solid rgba(255,255,255,0.05)' : mod.completed ? '1px solid rgba(16,185,129,0.2)' : '1px solid rgba(124,58,237,0.25)',
                  opacity: mod.locked ? 0.65 : 1,
                }}
              >
                <button
                  onClick={() => !mod.locked && setExpandedModule(expandedModule === mod.id ? null : mod.id)}
                  className="w-full p-4 flex items-center gap-3 text-left"
                >
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{
                      background: mod.completed ? 'rgba(16,185,129,0.2)' : mod.locked ? 'rgba(255,255,255,0.05)' : 'rgba(124,58,237,0.2)',
                    }}>
                    {mod.completed ? <Check size={18} color="#10b981" /> :
                      mod.locked ? <Lock size={18} color="#475569" /> :
                      <span style={{ color: '#a78bfa', fontWeight: 700, fontSize: '0.9rem' }}>M{modIndex + 1}</span>}
                  </div>
                  <div className="flex-1">
                    <div style={{ color: mod.locked ? 'var(--cp-text-faint)' : 'var(--cp-text-primary)', fontWeight: 600, fontSize: '0.9rem' }}>{mod.title}</div>
                    <div style={{ color: 'var(--cp-text-muted)', fontSize: '0.75rem' }}>
                      {mod.lessons.length} lessons · <span style={{ color: '#f59e0b' }}>+{mod.xpReward} XP</span>
                    </div>
                  </div>
                  {!mod.locked && (
                    expandedModule === mod.id ? <ChevronUp size={18} color="#64748b" /> : <ChevronDown size={18} color="#64748b" />
                  )}
                </button>

                {/* Lessons */}
                <AnimatePresence>
                  {expandedModule === mod.id && !mod.locked && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 pb-4 space-y-2 pt-1">
                        {mod.lessons.map((lesson, lIndex) => (
                          <motion.button
                            key={lesson.id}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: lIndex * 0.05 }}
                            onClick={() => {
                              if (lesson.completed) return;
                              if (lesson.type === 'quiz') {
                                setQuizAnswer(null);
                                setQuizSubmitted(false);
                                setQuizLessonTarget({ moduleId: mod.id, lessonId: lesson.id });
                                setShowQuiz(true);
                              } else {
                                setActiveLesson({ courseId: course.id, moduleId: mod.id, lessonId: lesson.id });
                              }
                            }}
                            className="w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all"
                            style={{
                              background: lesson.completed ? 'rgba(16,185,129,0.08)' : 'rgba(255,255,255,0.04)',
                              border: lesson.completed ? '1px solid rgba(16,185,129,0.2)' : '1px solid rgba(255,255,255,0.06)',
                            }}
                          >
                            <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                              style={{ background: lesson.completed ? 'rgba(16,185,129,0.2)' : `${lessonColors[lesson.type]}20`, color: lesson.completed ? '#10b981' : lessonColors[lesson.type] }}>
                              {lesson.completed ? <Check size={13} /> : lessonIcons[lesson.type]}
                            </div>
                            <div className="flex-1">
                              <div style={{ color: 'var(--cp-text-primary)', fontSize: '0.82rem', fontWeight: 500 }}>{lesson.title}</div>
                              <div style={{ color: 'var(--cp-text-faint)', fontSize: '0.7rem' }}>{lesson.duration}</div>
                            </div>
                            {lesson.completed && (
                              <div className="shrink-0 flex items-center gap-1">
                                <Zap size={10} color="#f59e0b" />
                                <span style={{ color: '#f59e0b', fontSize: '0.7rem' }}>+80</span>
                              </div>
                            )}
                          </motion.button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            </div>
          ))}
        </div>
      </div>

      <CareerDialog
        open={Boolean(activeLesson)}
        onOpenChange={open => {
          if (!open) setActiveLesson(null);
        }}
        size="xl"
        contentClassName="border-violet-500/30"
      >
        {activeLesson && (
          <>
            <DialogTitle className="sr-only">{activeLessonRow?.title ?? 'Lesson'}</DialogTitle>
            <div className="flex items-start justify-between gap-3 pb-3 pr-8">
              <div>
                <div style={{ color: '#a78bfa', fontSize: '0.75rem' }}>Lesson</div>
                <h3 id="lesson-dialog-title" style={{ color: 'var(--cp-text-primary)', fontWeight: 700 }}>{activeLessonRow?.title ?? 'Lesson'}</h3>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <div className="flex items-center gap-1" style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '12px', padding: '4px 10px' }}>
                  <Zap size={12} color="#f59e0b" />
                  <span style={{ color: '#f59e0b', fontSize: '0.8rem', fontWeight: 600 }}>+80 XP</span>
                </div>
              </div>
            </div>

            <div style={{ color: 'var(--cp-text-muted)', fontSize: '0.85rem', lineHeight: '1.7' }} className="pb-4">
              {mockLessonContent.split('\n').map((line, i) => {
                if (line.startsWith('## ')) return <h2 key={i} style={{ color: 'var(--cp-text-primary)', fontWeight: 700, fontSize: '1.1rem', margin: '16px 0 8px' }}>{line.replace('## ', '')}</h2>;
                if (line.startsWith('### ')) return <h3 key={i} style={{ color: 'var(--cp-text-primary)', fontWeight: 600, fontSize: '0.95rem', margin: '14px 0 6px' }}>{line.replace('### ', '')}</h3>;
                if (line.startsWith('> ')) return <div key={i} className="rounded-xl p-3 my-3" style={{ background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.25)', color: '#a78bfa', fontSize: '0.82rem' }}>{line.replace('> ', '')}</div>;
                if (line.startsWith('```')) return null;
                if (line.startsWith('**') && line.endsWith('**')) return <p key={i} style={{ color: 'var(--cp-text-primary)', fontWeight: 600, margin: '8px 0 4px' }}>{line.replace(/\*\*/g, '')}</p>;
                if (line.match(/^\d\./)) return <div key={i} className="flex items-start gap-2 my-1"><span style={{ color: '#7c3aed', fontWeight: 600, minWidth: '16px' }}>{line.charAt(0)}.</span><span>{line.slice(2)}</span></div>;
                if (line.startsWith('- ')) return <div key={i} className="flex items-start gap-2 my-1"><span style={{ color: '#7c3aed' }}>•</span><span>{line.slice(2)}</span></div>;
                if (line.includes('`') && !line.includes('```')) {
                  return <p key={i} className="my-1">{line.split('`').map((part, j) => j % 2 === 0 ? part : <code key={j} style={{ background: 'rgba(124,58,237,0.2)', color: '#a78bfa', padding: '1px 5px', borderRadius: '4px', fontFamily: 'Space Mono, monospace', fontSize: '0.8rem' }}>{part}</code>)}</p>;
                }
                if (line.trim()) return <p key={i} className="my-1">{line}</p>;
                return <div key={i} style={{ height: '8px' }} />;
              })}
            </div>

            <div className="sticky bottom-0 -mx-5 px-5 pb-2 pt-4" style={{ borderTop: '1px solid var(--cp-border)', background: 'var(--cp-bg-card-solid)' }}>
              <motion.button
                type="button"
                onClick={() => handleCompleteLesson(activeLesson.moduleId, activeLesson.lessonId)}
                whileTap={{ scale: 0.97 }}
                className="btn-primary w-full py-4 rounded-2xl flex items-center justify-center gap-3"
                style={{ fontWeight: 700, fontSize: '1rem' }}
              >
                <Check size={20} />
                Mark Complete & Earn XP
              </motion.button>
            </div>
          </>
        )}
      </CareerDialog>

      <CareerDialog
        open={showQuiz}
        size="lg"
        onOpenChange={open => {
          if (!open) {
            setShowQuiz(false);
            setQuizAnswer(null);
            setQuizSubmitted(false);
            setQuizLessonTarget(null);
          }
        }}
        contentClassName="border-amber-500/30"
      >
        <DialogTitle className="sr-only">Knowledge check</DialogTitle>
        <div className="flex items-center gap-2 mb-5 pr-8">
          <HelpCircle size={20} color="#f59e0b" />
          <h3 id="quiz-dialog-title" style={{ color: 'var(--cp-text-primary)', fontWeight: 700 }}>Knowledge Check</h3>
          <div className="ml-auto flex items-center gap-1" style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: '12px', padding: '4px 10px' }}>
            <Zap size={12} color="#f59e0b" />
            <span style={{ color: '#f59e0b', fontSize: '0.8rem', fontWeight: 600 }}>+120 XP</span>
          </div>
        </div>

        <p style={{ color: 'var(--cp-text-primary)', fontSize: '0.95rem', fontWeight: 600, marginBottom: '20px' }}>
          Which of the following best describes Expo Router's routing approach?
        </p>

        <div className="space-y-3 mb-6">
          {quizOptions.map((option, i) => (
            <motion.button
              key={i}
              type="button"
              onClick={() => !quizSubmitted && setQuizAnswer(i)}
              whileTap={{ scale: 0.98 }}
              className="w-full text-left p-4 rounded-2xl transition-all"
              style={{
                background: quizSubmitted ?
                  (i === 0 ? 'rgba(16,185,129,0.15)' : quizAnswer === i ? 'rgba(244,63,94,0.1)' : 'rgba(255,255,255,0.04)') :
                  quizAnswer === i ? 'rgba(124,58,237,0.2)' : 'rgba(255,255,255,0.04)',
                border: quizSubmitted ?
                  (i === 0 ? '1px solid rgba(16,185,129,0.4)' : quizAnswer === i ? '1px solid rgba(244,63,94,0.3)' : '1px solid rgba(255,255,255,0.06)') :
                  quizAnswer === i ? '1px solid rgba(124,58,237,0.5)' : '1px solid rgba(255,255,255,0.06)',
              }}
            >
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                  style={{
                    background: quizSubmitted && i === 0 ? 'rgba(16,185,129,0.2)' :
                      quizAnswer === i ? 'rgba(124,58,237,0.3)' : 'rgba(255,255,255,0.06)',
                  }}>
                  <span style={{ fontWeight: 700, fontSize: '0.8rem', color: quizAnswer === i ? '#a78bfa' : '#475569' }}>
                    {String.fromCharCode(65 + i)}
                  </span>
                </div>
                <span style={{ color: 'var(--cp-text-primary)', fontSize: '0.88rem' }}>{option}</span>
                {quizSubmitted && i === 0 && <Check size={16} color="#10b981" className="ml-auto shrink-0" />}
              </div>
            </motion.button>
          ))}
        </div>

        {quizSubmitted ? (
          <div>
            <div className="rounded-2xl p-4 mb-4 text-center"
              style={{ background: quizAnswer === 0 ? 'rgba(16,185,129,0.1)' : 'rgba(244,63,94,0.1)', border: `1px solid ${quizAnswer === 0 ? 'rgba(16,185,129,0.3)' : 'rgba(244,63,94,0.3)'}` }}>
              <div className="text-2xl mb-1">{quizAnswer === 0 ? '🎉' : '💡'}</div>
              <div style={{ color: quizAnswer === 0 ? '#10b981' : '#f43f5e', fontWeight: 700 }}>
                {quizAnswer === 0 ? 'Correct! +120 XP earned!' : 'Not quite! The correct answer is A.'}
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                if (quizAnswer === 0 && quizLessonTarget) {
                  completeLesson(course.id, quizLessonTarget.moduleId, quizLessonTarget.lessonId, 120);
                }
                setShowQuiz(false);
                setQuizAnswer(null);
                setQuizSubmitted(false);
                setQuizLessonTarget(null);
              }}
              className="btn-primary w-full py-3 rounded-xl"
              style={{ fontWeight: 600 }}
            >
              Continue →
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => quizAnswer !== null && setQuizSubmitted(true)}
            className="w-full py-3 rounded-xl"
            disabled={quizAnswer === null}
            style={{
              background: quizAnswer !== null ? 'linear-gradient(135deg, #f59e0b, #fbbf24)' : 'rgba(255,255,255,0.05)',
              border: 'none',
              color: quizAnswer !== null ? 'var(--cp-text-inverse)' : 'var(--cp-text-faint)',
              fontWeight: 700,
              cursor: quizAnswer !== null ? 'pointer' : 'not-allowed',
            }}
          >
            Submit Answer
          </button>
        )}
      </CareerDialog>
    </div>
  );
}
