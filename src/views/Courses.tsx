'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import { Sparkles, ChevronRight, Zap, Lock, Check, Plus, Search, X } from 'lucide-react';
import { useGame } from '../components/GameContext';
import { CareerDialog } from '../components/CareerDialog';
import { DialogTitle } from '@/components/ui/dialog';
import { AsyncState } from '@/components/AsyncState';
import {
  isApiError,
  submitCourseGenerationRequest,
  fetchRecommendedCourses,
  enrollInCourse,
  type RecommendedCourse,
} from '@/api';

export function Courses() {
  const router = useRouter();
  const { courses, addCourse, isHydrating, refresh } = useGame();
  const [showGenerator, setShowGenerator] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState(false);
  const [lastGeneratedCourseId, setLastGeneratedCourseId] = useState<string | null>(null);
  const [courseTitle, setCourseTitle] = useState('');
  const [goals, setGoals] = useState<string[]>([]);
  const [goalInput, setGoalInput] = useState('');
  const [skillLevel, setSkillLevel] = useState('Intermediate');
  const [duration, setDuration] = useState('30');
  const [learningStyle, setLearningStyle] = useState('Hands-on Projects');
  const [searchQuery, setSearchQuery] = useState('');
  const [generatorError, setGeneratorError] = useState<string | null>(null);
  const [recommendedCourses, setRecommendedCourses] = useState<RecommendedCourse[]>([]);
  const [recLoading, setRecLoading] = useState(true);
  const [startingId, setStartingId] = useState<string | null>(null);

  useEffect(() => {
    void fetchRecommendedCourses()
      .then(setRecommendedCourses)
      .catch(() => setRecommendedCourses([]))
      .finally(() => setRecLoading(false));
  }, []);

  const continueCourses = useMemo(
    () => courses.filter(c => c.progress > 0 && c.progress < 100),
    [courses],
  );
  const completedCourses = useMemo(
    () => courses.filter(c => c.progress >= 100),
    [courses],
  );

  const resetGeneratorUi = () => {
    setGenerating(false);
    setGenerated(false);
    setLastGeneratedCourseId(null);
    setGeneratorError(null);
  };

  const handleGenerate = async () => {
    if (!courseTitle.trim()) return;
    setGeneratorError(null);
    setGenerating(true);
    setLastGeneratedCourseId(null);
    try {
      const result = await submitCourseGenerationRequest({
        title: courseTitle.trim(),
        goals,
        skillLevel,
        durationDays: parseInt(duration, 10) || 30,
        learningStyle,
      });
      if (result.course?.id) {
        addCourse(result.course);
        setLastGeneratedCourseId(result.course.id);
        setGenerating(false);
        setGenerated(true);
      } else {
        setGeneratorError('Course was queued but no course was returned. Try again.');
        setGenerating(false);
      }
    } catch (e) {
      setGeneratorError(isApiError(e) ? e.message : 'Could not reach the course service. Try again.');
      setGenerating(false);
    }
  };

  const addGoal = () => {
    if (goalInput.trim() && goals.length < 6) {
      setGoals(prev => [...prev, goalInput.trim()]);
      setGoalInput('');
    }
  };

  const lessonTypeColors: Record<string, string> = {
    video: '#7c3aed', reading: '#06b6d4', quiz: '#f59e0b', project: '#10b981',
  };

  const lessonTypeIcons: Record<string, string> = {
    video: '▶️', reading: '📖', quiz: '❓', project: '🛠️',
  };

  const filteredCourses = useMemo(
    () => courses.filter(c => c.title.toLowerCase().includes(searchQuery.toLowerCase())),
    [courses, searchQuery],
  );

  return (
    <div className="app-page" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
      {/* Header */}
      <div className="section-pad pt-5 pb-4">
        <div className="flex items-center justify-between mb-1">
          <h1 style={{ color: 'var(--cp-text-primary)', fontWeight: 700, fontSize: '1.3rem' }}>AI Courses</h1>
          <motion.button
            type="button"
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              resetGeneratorUi();
              setShowGenerator(true);
            }}
            className="flex items-center gap-2 rounded-xl px-3 py-2"
            style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)', color: 'white', border: 'none', fontSize: '0.82rem', fontWeight: 600 }}
          >
            <Sparkles size={14} />
            Generate
          </motion.button>
        </div>
        <p style={{ color: 'var(--cp-text-muted)', fontSize: '0.85rem' }}>Your personalized learning universe</p>
      </div>

      {/* Search */}
      <div className="section-pad mb-5">
        <div className="flex items-center gap-3 rounded-2xl px-4 py-3"
          style={{ background: 'var(--cp-bg-card)', border: '1px solid var(--cp-border)' }}>
          <Search size={16} color="#475569" />
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search courses..."
            className="flex-1 outline-none bg-transparent"
            style={{ color: 'var(--cp-text-primary)', fontSize: '0.9rem' }}
          />
        </div>
      </div>

      {/* Continue Learning */}
      {continueCourses.length > 0 && (
        <div className="section-pad mb-5">
          <h3 style={{ color: 'var(--cp-text-primary)', fontWeight: 700, marginBottom: '12px' }}>Continue Learning</h3>
          <div className="space-y-3">
            {continueCourses.map(course => (
              <motion.button
                key={course.id}
                type="button"
                onClick={() => router.push(`/app/courses/${course.id}`)}
                className="w-full text-left glass-card rounded-2xl p-4 flex items-center gap-3"
                whileTap={{ scale: 0.98 }}
              >
                <span className="text-2xl">{course.thumbnail}</span>
                <div className="flex-1 min-w-0">
                  <div style={{ color: 'var(--cp-text-primary)', fontWeight: 600, fontSize: '0.9rem' }}>{course.title}</div>
                  <div style={{ color: '#a78bfa', fontSize: '0.75rem' }}>{course.progress}% complete</div>
                </div>
                <ChevronRight size={18} color="#475569" />
              </motion.button>
            ))}
          </div>
        </div>
      )}

      {/* My Courses */}
      <div className="section-pad mb-5">
        <h3 style={{ color: 'var(--cp-text-primary)', fontWeight: 700, marginBottom: '12px' }}>
          My Courses <span style={{ color: 'var(--cp-text-faint)', fontWeight: 400 }}>({filteredCourses.length})</span>
        </h3>
        <div className="space-y-4">
          {isHydrating && filteredCourses.length === 0 && (
            <div className="animate-pulse space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="rounded-3xl h-24" style={{ background: 'var(--cp-bg-card)' }} />
              ))}
            </div>
          )}
          {!isHydrating && filteredCourses.length === 0 && (
            <div
              className="rounded-3xl p-8 text-center glass-card"
              style={{ border: '1px dashed rgba(255,255,255,0.12)' }}
            >
              <p style={{ fontSize: '2rem', marginBottom: '8px' }}>📚</p>
              <p style={{ color: 'var(--cp-text-muted)', fontSize: '0.9rem', marginBottom: '8px' }}>
                {searchQuery ? 'No courses match your search.' : 'No courses yet — generate your AI learning roadmap!'}
              </p>
              {searchQuery ? (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="text-sm"
                  style={{ color: '#a78bfa', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  Clear search
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void refresh()}
                  className="text-sm"
                  style={{ color: '#a78bfa', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  Retry loading courses
                </button>
              )}
            </div>
          )}
          {filteredCourses.map((course, i) => (
            <motion.button
              key={course.id}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07 }}
              onClick={() => router.push(`/app/courses/${course.id}`)}
              className="w-full text-left rounded-3xl overflow-hidden"
              style={{ background: 'var(--cp-bg-card)', border: '1px solid var(--cp-border)' }}
              whileTap={{ scale: 0.98 }}
            >
              {/* Course header */}
              <div className="p-4 flex items-start gap-4">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shrink-0"
                  style={{
                    background: course.aiGenerated ?
                      'linear-gradient(135deg, rgba(124,58,237,0.3), rgba(6,182,212,0.2))' :
                      'rgba(255,255,255,0.06)',
                    border: course.aiGenerated ? '1px solid rgba(124,58,237,0.3)' : '1px solid rgba(255,255,255,0.1)',
                  }}>
                  {course.thumbnail}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {course.aiGenerated && (
                      <div className="rounded-md px-2 py-0.5" style={{ background: 'rgba(124,58,237,0.2)', border: '1px solid rgba(124,58,237,0.3)' }}>
                        <span style={{ color: '#a78bfa', fontSize: '0.6rem', fontWeight: 700 }}>AI GEN</span>
                      </div>
                    )}
                    <span style={{ color: 'var(--cp-text-muted)', fontSize: '0.72rem' }}>{course.difficulty}</span>
                  </div>
                  <div style={{ color: 'var(--cp-text-primary)', fontWeight: 700, fontSize: '0.9rem', marginBottom: '2px' }} className="line-clamp-2">{course.title}</div>
                  <div style={{ color: 'var(--cp-text-muted)', fontSize: '0.75rem' }}>{course.estimatedDays} days · {course.totalXp} XP total</div>
                </div>
                <ChevronRight size={18} color="#475569" className="shrink-0 mt-1" />
              </div>

              {/* Progress bar */}
              <div className="px-4 pb-4">
                <div className="flex justify-between mb-2">
                  <span style={{ color: 'var(--cp-text-muted)', fontSize: '0.72rem' }}>Progress</span>
                  <span style={{ color: '#a78bfa', fontSize: '0.72rem', fontWeight: 600 }}>{course.progress}%</span>
                </div>
                <div className="rounded-full overflow-hidden" style={{ background: 'var(--cp-bg-elevated)', height: '6px' }}>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${course.progress}%` }}
                    transition={{ duration: 1 }}
                    style={{ height: '100%', borderRadius: '999px', background: 'linear-gradient(90deg, #7c3aed, #06b6d4)' }}
                  />
                </div>
                {/* Module chips */}
                <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
                  {course.modules.slice(0, 4).map(mod => (
                    <div key={mod.id} className="shrink-0 flex items-center gap-1.5 rounded-xl px-2 py-1"
                      style={{
                        background: mod.completed ? 'rgba(16,185,129,0.15)' : mod.locked ? 'rgba(255,255,255,0.04)' : 'rgba(124,58,237,0.15)',
                        border: `1px solid ${mod.completed ? 'rgba(16,185,129,0.3)' : mod.locked ? 'rgba(255,255,255,0.06)' : 'rgba(124,58,237,0.3)'}`,
                      }}>
                      {mod.completed ? <Check size={10} color="#10b981" /> :
                        mod.locked ? <Lock size={10} color="#475569" /> :
                        <Zap size={10} color="#a78bfa" />}
                      <span style={{ fontSize: '0.65rem', color: mod.completed ? '#10b981' : mod.locked ? '#475569' : '#a78bfa', whiteSpace: 'nowrap' }}>
                        {mod.title.replace('Module ', 'M').split(':')[0]}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Recommended */}
      <div className="section-pad mb-6">
        <h3 style={{ color: 'var(--cp-text-primary)', fontWeight: 700, marginBottom: '12px' }}>Recommended for You</h3>
        <AsyncState loading={recLoading} empty={recommendedCourses.length === 0} emptyMessage="Recommendations will appear after profile setup.">
          <div className="space-y-3">
          {recommendedCourses.map((course, i) => (
            <motion.div
              key={course.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.07 }}
              className="glass-card rounded-2xl p-4 flex items-center gap-3"
              style={{ opacity: course.locked ? 0.6 : 1 }}
            >
              <div className="text-2xl">{course.thumbnail}</div>
              <div className="flex-1">
                <div style={{ color: 'var(--cp-text-primary)', fontWeight: 600, fontSize: '0.85rem' }}>{course.title}</div>
                <div style={{ color: 'var(--cp-text-muted)', fontSize: '0.75rem' }}>
                  {course.difficulty} · {course.days} days
                </div>
                <div className="flex gap-1.5 mt-2">
                  {course.tags.map(tag => (
                    <span key={tag} className="rounded-md px-2 py-0.5" style={{ background: 'var(--cp-bg-elevated)', color: 'var(--cp-text-muted)', fontSize: '0.65rem' }}>{tag}</span>
                  ))}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="flex items-center gap-1 mb-1">
                  <Zap size={12} color="#f59e0b" />
                  <span style={{ color: '#f59e0b', fontSize: '0.8rem', fontWeight: 700 }}>{course.xp}</span>
                </div>
                {course.locked ? (
                  <div className="flex items-center gap-1">
                    <Lock size={12} color="#475569" />
                    <span style={{ color: 'var(--cp-text-faint)', fontSize: '0.7rem' }}>Locked</span>
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={startingId === course.id}
                    onClick={() => {
                      void (async () => {
                        setStartingId(course.id);
                        try {
                          const result = await enrollInCourse({
                            courseTitle: course.title,
                            courseId: course.courseId ?? undefined,
                            resourceId: course.courseId ?? undefined,
                          });
                          const targetId = result.courseId;
                          if (result.course) addCourse(result.course);
                          void refresh();
                          router.push(`/app/courses/${targetId}`);
                        } catch (e) {
                          setGeneratorError(e instanceof Error ? e.message : 'Could not start course. Try again.');
                        } finally {
                          setStartingId(null);
                        }
                      })();
                    }}
                    className="rounded-xl px-3 py-1.5 text-xs font-semibold"
                    style={{ background: 'rgba(124,58,237,0.2)', border: '1px solid rgba(124,58,237,0.3)', color: '#a78bfa' }}
                  >
                    {startingId === course.id ? 'Starting…' : 'Start Learning'}
                  </button>
                )}
              </div>
            </motion.div>
          ))}
          </div>
        </AsyncState>
      </div>

      {completedCourses.length > 0 && (
        <div className="section-pad mb-6">
          <h3 style={{ color: 'var(--cp-text-primary)', fontWeight: 700, marginBottom: '12px' }}>Completed Courses</h3>
          <div className="space-y-2">
            {completedCourses.map(c => (
              <button
                key={c.id}
                type="button"
                onClick={() => router.push(`/app/courses/${c.id}`)}
                className="w-full text-left glass-card rounded-xl p-3 flex items-center gap-2"
              >
                <Check size={14} color="#10b981" />
                <span style={{ color: 'var(--cp-text-primary)', fontSize: '0.85rem' }}>{c.title}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <CareerDialog
        open={showGenerator}
        preventClose={generating}
        onOpenChange={open => {
          if (!open) {
            if (generating) return;
            setShowGenerator(false);
            resetGeneratorUi();
          } else {
            setShowGenerator(true);
          }
        }}
      >
        <DialogTitle className="sr-only">
          {generated ? 'Course generated' : generating ? 'Generating your course' : 'Generate an AI course'}
        </DialogTitle>
        {generated ? (
          <div className="text-center">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', delay: 0.2 }}
              className="text-5xl mb-4"
            >🤖</motion.div>
            <h3 className="text-gradient" style={{ fontWeight: 700, fontSize: '1.3rem', marginBottom: '8px' }}>
              Course Generated!
            </h3>
            <p style={{ color: 'var(--cp-text-muted)', fontSize: '0.85rem', marginBottom: '8px' }}>
              "{courseTitle}"
            </p>
            <div className="flex items-center justify-center gap-3 mb-6">
              <div className="rounded-xl px-3 py-1.5" style={{ background: 'rgba(124,58,237,0.2)', border: '1px solid rgba(124,58,237,0.3)' }}>
                <span style={{ color: '#a78bfa', fontSize: '0.8rem' }}>{duration} days</span>
              </div>
              <div className="flex items-center gap-1">
                <Zap size={14} color="#f59e0b" />
                <span style={{ color: '#f59e0b', fontSize: '0.8rem', fontWeight: 600 }}>+150 XP</span>
              </div>
            </div>
            <button
              type="button"
              disabled={!lastGeneratedCourseId}
              onClick={() => {
                if (!lastGeneratedCourseId) return;
                setShowGenerator(false);
                resetGeneratorUi();
                setCourseTitle('');
                setGoals([]);
                router.push(`/app/courses/${lastGeneratedCourseId}`);
              }}
              className="btn-primary w-full py-3 rounded-xl"
              style={{ fontWeight: 600, opacity: lastGeneratedCourseId ? 1 : 0.5 }}
            >
              Start Course 🚀
            </button>
          </div>
        ) : generating ? (
          <div className="text-center">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
              className="text-4xl mb-4 inline-block"
            >⚙️</motion.div>
            <h3 style={{ color: 'var(--cp-text-primary)', fontWeight: 700, fontSize: '1.1rem', marginBottom: '8px' }}>
              AI is building your course...
            </h3>
            <div className="space-y-2 mt-4">
              {['Analyzing your goals...', 'Structuring modules...', 'Creating lessons...', 'Adding quizzes...'].map((msg, i) => (
                <motion.div
                  key={msg}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.7 }}
                  className="flex items-center gap-3 text-left rounded-xl px-4 py-2"
                  style={{ background: 'var(--cp-bg-card)' }}
                >
                  <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
                  <span style={{ color: 'var(--cp-text-muted)', fontSize: '0.82rem' }}>{msg}</span>
                </motion.div>
              ))}
            </div>
          </div>
        ) : (
          <div>
            <div className="mb-5 pr-10">
              <h3 style={{ color: 'var(--cp-text-primary)', fontWeight: 700, fontSize: '1.1rem' }}>Generate AI Course</h3>
              <p style={{ color: 'var(--cp-text-muted)', fontSize: '0.78rem' }}>Personalized just for you</p>
            </div>

            {generatorError && (
              <div
                className="mb-4 rounded-xl px-3 py-2 text-sm"
                style={{ background: 'rgba(244,63,94,0.12)', border: '1px solid rgba(244,63,94,0.35)', color: '#fda4af' }}
                role="alert"
              >
                {generatorError}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label style={{ color: 'var(--cp-text-muted)', fontSize: '0.8rem', display: 'block', marginBottom: '6px' }}>Course Title *</label>
                <input
                  value={courseTitle}
                  onChange={e => setCourseTitle(e.target.value)}
                  placeholder="e.g. Master React Native for Production"
                  className="w-full rounded-xl px-4 py-3 outline-none"
                  style={{ background: 'var(--cp-bg-elevated)', border: '1px solid var(--cp-border)', color: 'var(--cp-text-primary)', fontSize: '0.9rem' }}
                />
              </div>

              <div>
                <label style={{ color: 'var(--cp-text-muted)', fontSize: '0.8rem', display: 'block', marginBottom: '6px' }}>Learning Goals</label>
                <div className="flex gap-2 mb-2">
                  <input
                    value={goalInput}
                    onChange={e => setGoalInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addGoal()}
                    placeholder="e.g. Learn animations"
                    className="flex-1 rounded-xl px-3 py-2 outline-none text-sm"
                    style={{ background: 'var(--cp-bg-elevated)', border: '1px solid var(--cp-border)', color: 'var(--cp-text-primary)' }}
                  />
                  <button type="button" onClick={addGoal} className="btn-primary rounded-xl px-3 py-2"><Plus size={16} /></button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {goals.map(g => (
                    <div key={g} className="flex items-center gap-1.5 rounded-xl px-3 py-1.5"
                      style={{ background: 'rgba(124,58,237,0.2)', border: '1px solid rgba(124,58,237,0.3)' }}>
                      <span style={{ color: '#a78bfa', fontSize: '0.78rem' }}>{g}</span>
                      <button type="button" onClick={() => setGoals(prev => prev.filter(x => x !== g))}>
                        <X size={10} color="#64748b" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ color: 'var(--cp-text-muted)', fontSize: '0.8rem', display: 'block', marginBottom: '6px' }}>Skill Level</label>
                <div className="flex gap-2">
                  {['Beginner', 'Intermediate', 'Advanced'].map(l => (
                    <button key={l} type="button" onClick={() => setSkillLevel(l)}
                      className="flex-1 py-2 rounded-xl text-sm transition-all"
                      style={{
                        background: skillLevel === l ? 'rgba(124,58,237,0.3)' : 'rgba(255,255,255,0.05)',
                        border: skillLevel === l ? '1px solid rgba(124,58,237,0.5)' : '1px solid rgba(255,255,255,0.08)',
                        color: skillLevel === l ? '#a78bfa' : '#64748b',
                        fontWeight: skillLevel === l ? 600 : 400,
                      }}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ color: 'var(--cp-text-muted)', fontSize: '0.8rem', display: 'block', marginBottom: '6px' }}>Duration (days): {duration}</label>
                <input
                  type="range" min="7" max="90" value={duration}
                  onChange={e => setDuration(e.target.value)}
                  className="w-full"
                  style={{ accentColor: '#7c3aed' }}
                />
                <div className="flex justify-between">
                  <span style={{ color: 'var(--cp-text-faint)', fontSize: '0.68rem' }}>7 days</span>
                  <span style={{ color: 'var(--cp-text-faint)', fontSize: '0.68rem' }}>90 days</span>
                </div>
              </div>

              <div>
                <label style={{ color: 'var(--cp-text-muted)', fontSize: '0.8rem', display: 'block', marginBottom: '6px' }}>Learning Style</label>
                <div className="responsive-grid-2">
                  {['Hands-on Projects', 'Video Lectures', 'Reading + Practice', 'Mixed Approach'].map(style => (
                    <button key={style} type="button" onClick={() => setLearningStyle(style)}
                      className="py-2 px-3 rounded-xl text-xs text-left transition-all"
                      style={{
                        background: learningStyle === style ? 'rgba(124,58,237,0.25)' : 'rgba(255,255,255,0.05)',
                        border: learningStyle === style ? '1px solid rgba(124,58,237,0.4)' : '1px solid rgba(255,255,255,0.08)',
                        color: learningStyle === style ? '#a78bfa' : '#64748b',
                        fontWeight: learningStyle === style ? 600 : 400,
                      }}>
                      {style}
                    </button>
                  ))}
                </div>
              </div>

              <motion.button
                type="button"
                onClick={() => void handleGenerate()}
                whileTap={{ scale: 0.97 }}
                disabled={!courseTitle.trim() || generating}
                className="w-full py-4 rounded-2xl flex items-center justify-center gap-3 mt-2"
                style={{
                  background:
                    courseTitle.trim() && !generating
                      ? 'linear-gradient(135deg, #7c3aed, #4f46e5)'
                      : 'rgba(255,255,255,0.05)',
                  border: 'none',
                  color: courseTitle.trim() && !generating ? 'white' : '#475569',
                  fontWeight: 700,
                  fontSize: '1rem',
                  cursor: courseTitle.trim() && !generating ? 'pointer' : 'not-allowed',
                  opacity: generating ? 0.75 : 1,
                }}
              >
                {generating ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    Generating…
                  </span>
                ) : (
                  <>
                    <Sparkles size={20} />
                    Generate My Course
                    <span style={{ fontSize: '0.8rem', opacity: 0.8 }}>+150 XP</span>
                  </>
                )}
              </motion.button>
            </div>
          </div>
        )}
      </CareerDialog>
    </div>
  );
}
