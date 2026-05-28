'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import { BookOpen, Clock, Zap, X } from 'lucide-react';
import { useGame } from '@/components/GameContext';
import { useProfileInsights } from '@/lib/hooks/use-profile-insights';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

function courseMatchesSkill(courseTags: string[], courseTitle: string, skill: string): number {
  const s = skill.toLowerCase();
  const hay = `${courseTitle} ${courseTags.join(' ')}`.toLowerCase();
  if (hay.includes(s)) return 95;
  const tokens = s.split(/[\s/]+/).filter(Boolean);
  const hits = tokens.filter(t => hay.includes(t)).length;
  return Math.min(90, 40 + hits * 20);
}

export function RecommendedSkillsPanel() {
  const router = useRouter();
  const { user, courses } = useGame();
  const { data: insights, isLoading, isError, refetch } = useProfileInsights(user.profileVersion);
  const [selectedSkill, setSelectedSkill] = useState<string | null>(null);

  const recommended = useMemo(() => {
    const fromInsights = insights?.recommendedSkills ?? [];
    const unique: string[] = [];
    for (const s of fromInsights) {
      if (!user.skills.some(us => us.toLowerCase() === s.toLowerCase()) && !unique.includes(s)) {
        unique.push(s);
      }
    }
    return unique.slice(0, 6);
  }, [insights?.recommendedSkills, user.skills]);

  const relatedCourses = useMemo(() => {
    if (!selectedSkill) return [];
    const insightCourses = (insights?.recommendedCourses ?? [])
      .filter(c => courseMatchesSkill(c.tags, c.title, selectedSkill) >= 50)
      .map(c => ({
        course: {
          id: c.courseId ?? c.title,
          title: c.title,
          description: c.reason,
          difficulty: c.difficulty as 'Beginner' | 'Intermediate' | 'Advanced',
          estimatedDays: c.days,
          totalXp: c.days * 40,
          tags: c.tags,
        },
        relevance: courseMatchesSkill(c.tags, c.title, selectedSkill),
        fromInsights: true,
      }));

    const fromCatalog = courses
      .map(c => ({
        course: c,
        relevance: courseMatchesSkill(c.tags ?? [], c.title, selectedSkill),
        fromInsights: false,
      }))
      .filter(x => x.relevance >= 50);

    return [...insightCourses, ...fromCatalog]
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, 5);
  }, [courses, insights?.recommendedCourses, selectedSkill]);

  if (isLoading) {
    return (
      <div className="glass-card rounded-3xl p-5 mt-4 animate-pulse">
        <div className="h-4 w-40 rounded mb-3" style={{ background: 'var(--cp-bg-elevated)' }} />
        {[1, 2, 3].map(i => (
          <div key={i} className="h-10 rounded-xl mb-2" style={{ background: 'var(--cp-bg-elevated)' }} />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="glass-card rounded-3xl p-5 mt-4">
        <p className="text-sm text-rose-400 mb-2">Could not load skill recommendations.</p>
        <button type="button" onClick={() => void refetch()} className="text-xs font-semibold" style={{ color: '#a78bfa' }}>
          Retry
        </button>
      </div>
    );
  }

  if (recommended.length === 0) return null;

  return (
    <>
      <div className="glass-card rounded-3xl p-5 mt-4">
        <h3 style={{ color: 'var(--cp-text-primary)', fontWeight: 700, marginBottom: '4px' }}>Recommended to Learn</h3>
        <p style={{ color: 'var(--cp-text-muted)', fontSize: '0.78rem', marginBottom: '16px' }}>
          From your career insights{user.targetRole ? ` · target: ${user.targetRole}` : ''}
        </p>
        {recommended.map(skill => {
          const gap = insights?.skillsGap.find(g => g.skill.toLowerCase() === skill.toLowerCase());
          return (
            <button
              key={skill}
              type="button"
              onClick={() => setSelectedSkill(skill)}
              className="flex items-center gap-3 mb-3 last:mb-0 w-full text-left rounded-xl px-2 py-1.5 transition-colors hover:bg-[var(--cp-bg-hover)]"
            >
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)' }}
              >
                <span style={{ fontSize: '0.85rem' }}>⚡</span>
              </div>
              <div className="flex-1 min-w-0">
                <div style={{ color: 'var(--cp-text-primary)', fontSize: '0.85rem' }}>{skill}</div>
                <div style={{ color: 'var(--cp-text-muted)', fontSize: '0.72rem' }}>
                  {gap?.reason ?? 'Tap to see related courses'}
                </div>
              </div>
              <span style={{ color: '#a78bfa', fontSize: '0.75rem', fontWeight: 600 }}>Courses →</span>
            </button>
          );
        })}
      </div>

      <Dialog open={Boolean(selectedSkill)} onOpenChange={open => !open && setSelectedSkill(null)}>
        <DialogContent
          className="max-h-[85vh] overflow-y-auto sm:max-w-lg"
          style={{ fontFamily: "'Space Grotesk', sans-serif", background: 'var(--cp-bg-card-solid)', border: '1px solid var(--cp-border)' }}
        >
          <DialogHeader>
            <DialogTitle style={{ color: 'var(--cp-text-primary)' }}>{selectedSkill}</DialogTitle>
            <DialogDescription style={{ color: 'var(--cp-text-muted)' }}>
              Courses that help you build this skill
            </DialogDescription>
          </DialogHeader>

          {relatedCourses.length === 0 ? (
            <p style={{ color: 'var(--cp-text-muted)', fontSize: '0.85rem' }}>
              No matching courses yet. Browse all courses to find learning paths for {selectedSkill}.
            </p>
          ) : (
            <div className="space-y-3">
              {relatedCourses.map(({ course, relevance, fromInsights }) => (
                <motion.div
                  key={`${course.id}-${fromInsights}`}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-2xl p-4"
                  style={{ background: 'var(--cp-bg-elevated)', border: '1px solid var(--cp-border)' }}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div style={{ color: 'var(--cp-text-primary)', fontWeight: 600, fontSize: '0.9rem' }}>{course.title}</div>
                    <span className="text-xs px-2 py-0.5 rounded-full shrink-0" style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981' }}>
                      {relevance}% relevance
                    </span>
                  </div>
                  {'description' in course && (
                    <p style={{ color: 'var(--cp-text-muted)', fontSize: '0.75rem', marginBottom: '10px' }}>
                      {String(course.description).slice(0, 120)}
                      {String(course.description).length > 120 ? '…' : ''}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2 mb-3">
                    <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg" style={{ background: 'var(--cp-bg-card)', color: 'var(--cp-text-muted)' }}>
                      <Clock size={12} /> {'estimatedDays' in course ? `${course.estimatedDays}d` : '—'}
                    </span>
                    <span className="text-xs px-2 py-1 rounded-lg" style={{ background: 'var(--cp-bg-card)', color: 'var(--cp-text-muted)' }}>
                      {'difficulty' in course ? course.difficulty : 'Intermediate'}
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg" style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b' }}>
                      <Zap size={12} /> +{'totalXp' in course ? course.totalXp : 80} XP
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedSkill(null);
                      if (fromInsights && !('modules' in course)) {
                        router.push('/app/courses');
                      } else {
                        router.push(`/app/courses/${course.id}`);
                      }
                    }}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold btn-primary"
                  >
                    <BookOpen size={15} />
                    Start course
                  </button>
                </motion.div>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={() => setSelectedSkill(null)}
            className="mt-2 w-full flex items-center justify-center gap-2 py-2 rounded-xl text-sm"
            style={{ background: 'var(--cp-bg-card)', border: '1px solid var(--cp-border)', color: 'var(--cp-text-muted)' }}
          >
            <X size={14} /> Close
          </button>
        </DialogContent>
      </Dialog>
    </>
  );
}
