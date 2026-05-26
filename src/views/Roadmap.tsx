'use client';

import { useState } from 'react';
import { motion } from 'motion/react';
import { Lock, Check, ChevronRight, Zap, Star, Target, Award, Briefcase, BookOpen } from 'lucide-react';
import { useGame } from '../components/GameContext';

export function Roadmap() {
  const { level, courses, user, roadmapPlan } = useGame();
  const [selectedStageId, setSelectedStageId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'stages' | 'milestones' | 'certifications'>('stages');

  const palette = ['#10b981', '#7c3aed', '#06b6d4', '#f59e0b', '#a78bfa'];
  const stages = courses.map((course, idx) => {
    const lessons = (course.modules ?? []).flatMap(m => m.lessons ?? []);
    const skills = lessons.slice(0, 6).map(l => l.title);
    const color = palette[idx % palette.length];
    return {
      id: course.id,
      title: course.title,
      icon: course.thumbnail,
      color,
      description: course.description,
      skills,
      xpReward: course.totalXp,
      progress: course.progress,
      completed: course.progress >= 100,
    };
  });

  type PlanModule = { title: string; summary?: string; lessons?: string[]; durationWeeks?: number };
  const planModules = (roadmapPlan?.modules ?? []) as PlanModule[];
  const insightStages = planModules.map((m, idx) => ({
    id: `plan-mod-${idx}`,
    title: m.title,
    icon: '📘',
    color: palette[idx % palette.length],
    description: m.summary ?? '',
    skills: m.lessons ?? [],
    xpReward: 400,
    progress: 0,
    completed: false,
  }));

  const displayStages = stages.length > 0 ? stages : insightStages;

  const activeIndex = displayStages.findIndex(s => !s.completed);
  const resolvedActiveIndex = activeIndex === -1 ? Math.max(0, displayStages.length - 1) : activeIndex;
  const currentStage = displayStages[resolvedActiveIndex];
  const totalProgress = displayStages.length ? Math.round(displayStages.reduce((acc, s) => acc + (s.progress ?? 0), 0) / displayStages.length) : 0;

  // AI roadmap enrichment data
  const aiMilestones = roadmapPlan?.milestones ?? [];
  const aiCertifications = roadmapPlan?.certifications ?? [];
  const aiStages = roadmapPlan?.stages ?? [];
  const aiProjectIdeas = roadmapPlan?.projectIdeas ?? [];
  const aiIndustryNotes = roadmapPlan?.industryNotes;
  const roadmapWeeks = roadmapPlan?.weeks;

  const targetRole = user.targetRole?.trim() || roadmapPlan?.audience || 'Your career goal';
  const roadmapTitle = roadmapPlan?.title ?? `Career Roadmap`;
  const roadmapSubtitle = roadmapPlan?.subtitle ?? `Your personalized path to ${targetRole}`;

  const nextRecommendations = (() => {
    if (!currentStage) return [];
    const course = courses.find(c => c.id === currentStage.id);
    if (!course) return [];
    const nextLessons = course.modules.flatMap(m => m.lessons).filter(l => !l.completed);
    return nextLessons.slice(0, 3);
  })();

  const hasTabs = aiMilestones.length > 0 || aiCertifications.length > 0 || planModules.length > 0;

  return (
    <div className="app-page" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
      {/* Header */}
      <div className="section-pad pt-5 pb-4">
        <div className="flex items-center justify-between mb-1">
          <h1 style={{ color: 'var(--cp-text-primary)', fontWeight: 700, fontSize: '1.3rem' }}>{roadmapTitle}</h1>
          <div className="flex items-center gap-2 rounded-xl px-3 py-1.5"
            style={{ background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.3)' }}>
            <Star size={14} color="#a78bfa" />
            <span style={{ color: '#a78bfa', fontSize: '0.8rem', fontWeight: 600 }}>Level {level}</span>
          </div>
        </div>
        <p style={{ color: 'var(--cp-text-muted)', fontSize: '0.85rem' }}>{roadmapSubtitle}</p>
      </div>

      {/* Salary Progression — shown when user has salary data */}
      {user.currentSalary && Number(user.currentSalary) > 0 && (
        <div className="section-pad mb-4">
          <div className="glass-card rounded-3xl p-5">
            <h3 style={{ color: 'var(--cp-text-primary)', fontWeight: 700, marginBottom: '16px' }}>
              Expected Salary Progression
            </h3>
            <div className="space-y-1">
              {[
                { role: user.currentRole || 'Current Role', salary: Number(user.currentSalary), step: 0 },
                { role: `Senior ${user.currentRole || 'Professional'}`, salary: Math.round(Number(user.currentSalary) * 1.4), step: 1 },
                { role: user.targetRole || 'Target Role', salary: Math.round(Number(user.currentSalary) * 1.8), step: 2 },
              ].map((item, i) => {
                const symbol = user.salaryCurrency === 'INR' ? '₹' : '$';
                const fmt = (n: number) =>
                  user.salaryCurrency === 'INR'
                    ? n >= 100000 ? `${(n / 100000).toFixed(1)}L` : `${Math.round(n / 1000)}K`
                    : n >= 1000 ? `${Math.round(n / 1000)}K` : `${n}`;
                const isActive = i === 0;
                const growthPct = i < 2 ? Math.round(((item.salary * 1.4) / item.salary - 1) * 100) : null;
                return (
                  <div key={i}>
                    <div className="flex items-center gap-3 py-1">
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                        style={{
                          background: isActive ? 'linear-gradient(135deg, #7c3aed, #06b6d4)' : 'var(--cp-bg-elevated)',
                          border: isActive ? 'none' : '1px solid var(--cp-border)',
                        }}
                      >
                        <span style={{ color: isActive ? 'white' : 'var(--cp-text-faint)', fontSize: '0.75rem', fontWeight: 700 }}>{i + 1}</span>
                      </div>
                      <div className="flex-1">
                        <div style={{ color: 'var(--cp-text-primary)', fontSize: '0.85rem', fontWeight: isActive ? 700 : 500 }}>{item.role}</div>
                        <div style={{ color: isActive ? '#10b981' : 'var(--cp-text-muted)', fontSize: '0.78rem', fontWeight: 600 }}>
                          {symbol}{fmt(item.salary)}{user.salaryFrequency === 'Monthly' ? '/mo' : '/yr'}
                        </div>
                      </div>
                      {growthPct !== null && (
                        <div className="rounded-xl px-2 py-1" style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)' }}>
                          <span style={{ color: '#10b981', fontSize: '0.72rem', fontWeight: 600 }}>+{growthPct}% ↑</span>
                        </div>
                      )}
                    </div>
                    {i < 2 && (
                      <div className="ml-4 w-0.5 h-4" style={{ background: 'var(--cp-border)' }} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Career progress overview */}
      <div className="section-pad mb-5">
        <div className="glass-card rounded-3xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div style={{ color: 'var(--cp-text-muted)', fontSize: '0.75rem' }}>Current Phase</div>
              <div style={{ color: 'var(--cp-text-primary)', fontWeight: 700 }}>{currentStage?.title ?? 'No active roadmap'}</div>
            </div>
            <div className="text-right">
              <div style={{ color: 'var(--cp-text-muted)', fontSize: '0.75rem' }}>Est. completion</div>
              <div style={{ color: '#10b981', fontWeight: 600 }}>
                {roadmapWeeks
                  ? `~${roadmapWeeks} weeks`
                  : courses.length
                    ? `${Math.max(1, Math.round((courses.reduce((a, c) => a + (c.estimatedDays ?? 0), 0) / courses.length) || 4))} weeks`
                    : '—'}
              </div>
            </div>
          </div>
          <div className="rounded-full overflow-hidden" style={{ background: 'var(--cp-bg-elevated)', height: '8px' }}>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${totalProgress}%` }}
              transition={{ duration: 1.5 }}
              style={{ height: '100%', borderRadius: '999px', background: 'linear-gradient(90deg, #7c3aed, #06b6d4)' }}
            />
          </div>
          <div className="flex justify-between mt-2">
            <span style={{ color: 'var(--cp-text-faint)', fontSize: '0.72rem' }}>
              {stages.length ? `Phase ${resolvedActiveIndex + 1} of ${displayStages.length}` : displayStages.length ? `${displayStages.length} modules` : 'No phases'}
            </span>
            <span style={{ color: '#a78bfa', fontSize: '0.72rem' }}>{totalProgress}% complete</span>
          </div>
        </div>
      </div>

      {/* AI roadmap stage overview (from LLM) */}
      {aiStages.length > 0 && (
        <div className="section-pad mb-5">
          <h3 style={{ color: 'var(--cp-text-primary)', fontWeight: 700, marginBottom: '10px', fontSize: '0.95rem' }}>Career Phases</h3>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {aiStages.map((stage, i) => (
              <div
                key={i}
                className="shrink-0 rounded-2xl p-3"
                style={{ background: 'var(--cp-bg-card)', border: '1px solid var(--cp-border)', minWidth: '140px', maxWidth: '160px' }}
              >
                <div className="text-xs font-bold mb-1" style={{ color: palette[i % palette.length] }}>
                  {stage.timeframeWeeks ? `~${stage.timeframeWeeks}w` : `Phase ${i + 1}`}
                </div>
                <div style={{ color: 'var(--cp-text-primary)', fontWeight: 600, fontSize: '0.82rem', lineHeight: 1.3, marginBottom: '4px' }}>
                  {stage.title}
                </div>
                {stage.summary && (
                  <p style={{ color: 'var(--cp-text-muted)', fontSize: '0.72rem', lineHeight: 1.4 }}>{stage.summary}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabs: Modules / Milestones / Certs */}
      {hasTabs && (
        <div className="section-pad mb-4">
          <div className="flex rounded-2xl p-1" style={{ background: 'var(--cp-bg-card)' }}>
            {(
              [
                { id: 'stages' as const,        label: '📚 Modules' },
                { id: 'milestones' as const,     label: '🎯 Milestones' },
                { id: 'certifications' as const, label: '🏆 Certs' },
              ] as const
            ).map(t => (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id)}
                className="flex-1 py-2.5 rounded-xl transition-all"
                style={{
                  background: activeTab === t.id ? 'rgba(124,58,237,0.25)' : 'transparent',
                  color: activeTab === t.id ? '#a78bfa' : '#64748b',
                  fontWeight: activeTab === t.id ? 600 : 400,
                  fontSize: '0.78rem',
                  border: activeTab === t.id ? '1px solid rgba(124,58,237,0.35)' : '1px solid transparent',
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Roadmap modules (courses from AI) */}
      {(!hasTabs || activeTab === 'stages') && (
        <div className="section-pad mb-5">
          {!hasTabs && <h3 style={{ color: 'var(--cp-text-primary)', fontWeight: 700, marginBottom: '16px' }}>Learning Modules</h3>}
          <div className="relative">
            <div className="absolute left-[26px] top-10 bottom-10 w-0.5"
              style={{ background: 'linear-gradient(to bottom, #10b981, #7c3aed, rgba(255,255,255,0.08))' }} />
            <div className="space-y-4">
              {displayStages.length === 0 ? (
                <div className="glass-card rounded-2xl p-6 text-center">
                  <p style={{ color: 'var(--cp-text-muted)' }}>No roadmap yet. Upload your resume to generate a personalized plan.</p>
                </div>
              ) : (
                displayStages.map((stage, index) => (
                  <motion.div
                    key={stage.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedStageId(selectedStageId === stage.id ? null : stage.id)}
                      className="w-full text-left"
                    >
                      <div className="flex items-start gap-4">
                        <div className="relative z-10 w-12 h-12 sm:w-[52px] sm:h-[52px] rounded-2xl flex items-center justify-center shrink-0"
                          style={{
                            background: stage.id === currentStage?.id ? `linear-gradient(135deg, ${stage.color}, ${stage.color}cc)` : stage.completed ? `rgba(16,185,129,0.12)` : 'rgba(255,255,255,0.05)',
                            border: stage.id === currentStage?.id ? `2px solid ${stage.color}` : stage.completed ? 'none' : '1px solid rgba(255,255,255,0.08)',
                            boxShadow: stage.id === currentStage?.id ? `0 0 20px ${stage.color}40` : 'none',
                          }}>
                          {stage.completed ? (
                            <Check size={24} color="white" />
                          ) : stage.id !== currentStage?.id ? (
                            <Lock size={20} color="#475569" />
                          ) : (
                            <span style={{ fontSize: '1.4rem' }}>{stage.icon}</span>
                          )}
                        </div>

                        <div className="flex-1 rounded-2xl p-4"
                          style={{
                            background: selectedStageId === stage.id ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.03)',
                            border: `1px solid ${selectedStageId === stage.id ? stage.color + '40' : 'rgba(255,255,255,0.06)'}`,
                            opacity: stage.id !== currentStage?.id && !stage.completed ? 0.6 : 1,
                          }}>
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <span style={{ color: 'var(--cp-text-primary)', fontWeight: 700, fontSize: '0.9rem' }}>{stage.title}</span>
                              {stage.id === currentStage?.id && !stage.completed && (
                                <div className="rounded-md px-2 py-0.5" style={{ background: 'rgba(124,58,237,0.2)', border: '1px solid rgba(124,58,237,0.3)' }}>
                                  <span style={{ color: '#a78bfa', fontSize: '0.65rem', fontWeight: 600 }}>ACTIVE</span>
                                </div>
                              )}
                              {stage.completed && (
                                <div className="rounded-md px-2 py-0.5" style={{ background: 'rgba(16,185,129,0.15)' }}>
                                  <span style={{ color: '#10b981', fontSize: '0.65rem', fontWeight: 600 }}>DONE ✓</span>
                                </div>
                              )}
                            </div>
                            <ChevronRight size={16} color="#475569"
                              style={{ transform: selectedStageId === stage.id ? 'rotate(90deg)' : 'rotate(0)', transition: 'transform 0.2s' }} />
                          </div>

                          <p style={{ color: 'var(--cp-text-muted)', fontSize: '0.78rem', marginBottom: '8px' }}>{stage.description}</p>

                          <div className="flex items-center gap-2">
                            <Zap size={12} color="#f59e0b" />
                            <span style={{ color: '#f59e0b', fontSize: '0.75rem', fontWeight: 600 }}>{stage.xpReward} XP</span>
                          </div>

                          {stage.id === currentStage?.id && !stage.completed && (
                            <div className="mt-3">
                              <div className="rounded-full overflow-hidden" style={{ background: 'var(--cp-bg-elevated)', height: '4px' }}>
                                <motion.div
                                  initial={{ width: 0 }}
                                  animate={{ width: `${stage.progress}%` }}
                                  transition={{ duration: 1 }}
                                  style={{ height: '100%', borderRadius: '999px', background: `linear-gradient(90deg, ${stage.color}, ${stage.color}88)` }}
                                />
                              </div>
                              <span style={{ color: 'var(--cp-text-faint)', fontSize: '0.68rem' }}>{stage.progress}% complete</span>
                            </div>
                          )}

                          {selectedStageId === stage.id && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              className="mt-3 pt-3"
                              style={{ borderTop: '1px solid var(--cp-border)' }}
                            >
                              <p style={{ color: 'var(--cp-text-muted)', fontSize: '0.75rem', marginBottom: '8px' }}>Resources in this module:</p>
                              <div className="flex flex-wrap gap-2">
                                {stage.skills.map(skill => (
                                  <div key={skill} className="rounded-xl px-3 py-1"
                                    style={{ background: `${stage.color}15`, border: `1px solid ${stage.color}30`, color: stage.color, fontSize: '0.75rem' }}>
                                    {skill}
                                  </div>
                                ))}
                              </div>
                            </motion.div>
                          )}
                        </div>
                      </div>
                    </button>
                  </motion.div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Milestones tab */}
      {activeTab === 'milestones' && aiMilestones.length > 0 && (
        <div className="section-pad mb-5">
          <div className="space-y-3">
            {aiMilestones.map((milestone, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
                className="glass-card rounded-2xl p-4 flex items-center gap-3"
              >
                <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.25)' }}>
                  <span style={{ fontSize: '1rem' }}>{i < 3 ? '🎯' : i < 6 ? '⭐' : '🔥'}</span>
                </div>
                <span style={{ color: 'var(--cp-text-primary)', fontSize: '0.85rem', lineHeight: 1.4 }}>{milestone}</span>
              </motion.div>
            ))}
          </div>

          {/* Project ideas */}
          {aiProjectIdeas.length > 0 && (
            <div className="mt-5">
              <div className="flex items-center gap-2 mb-3">
                <Briefcase size={16} color="#06b6d4" />
                <h4 style={{ color: 'var(--cp-text-primary)', fontWeight: 700, fontSize: '0.9rem' }}>Portfolio Project Ideas</h4>
              </div>
              <div className="space-y-2">
                {aiProjectIdeas.map((idea, i) => (
                  <div key={i} className="glass-card rounded-xl p-3 flex items-start gap-3">
                    <span style={{ color: '#06b6d4', fontSize: '0.75rem', fontWeight: 700, minWidth: '20px' }}>{i + 1}.</span>
                    <span style={{ color: 'var(--cp-text-muted)', fontSize: '0.82rem', lineHeight: 1.4 }}>{idea}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Certifications tab */}
      {activeTab === 'certifications' && aiCertifications.length > 0 && (
        <div className="section-pad mb-5">
          <div className="space-y-3">
            {aiCertifications.map((cert, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
                className="glass-card rounded-2xl p-4 flex items-center gap-3"
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.25)' }}>
                  <Award size={18} color="#f59e0b" />
                </div>
                <div className="flex-1">
                  <div style={{ color: 'var(--cp-text-primary)', fontWeight: 600, fontSize: '0.85rem' }}>{cert.title}</div>
                  {cert.issuer && (
                    <div style={{ color: 'var(--cp-text-muted)', fontSize: '0.75rem', marginTop: '2px' }}>{cert.issuer}</div>
                  )}
                </div>
                {cert.url && (
                  <a
                    href={cert.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 rounded-xl px-3 py-1.5 text-xs font-semibold"
                    style={{ background: 'rgba(245,158,11,0.15)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.3)' }}
                  >
                    View →
                  </a>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Industry Notes */}
      {aiIndustryNotes && activeTab !== 'certifications' && (
        <div className="section-pad mb-5">
          <div className="glass-card rounded-2xl p-4 flex items-start gap-3"
            style={{ border: '1px solid rgba(6,182,212,0.2)' }}>
            <BookOpen size={16} color="#06b6d4" className="mt-0.5 shrink-0" />
            <div>
              <div style={{ color: '#06b6d4', fontWeight: 600, fontSize: '0.8rem', marginBottom: '4px' }}>Industry Notes</div>
              <p style={{ color: 'var(--cp-text-muted)', fontSize: '0.8rem', lineHeight: 1.5 }}>{aiIndustryNotes}</p>
            </div>
          </div>
        </div>
      )}

      {/* 4-Week Milestones (next lessons) */}
      {!hasTabs && (
        <div className="section-pad mb-4">
          <div className="glass-card rounded-3xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Target size={18} color="#a78bfa" />
              <h3 style={{ color: 'var(--cp-text-primary)', fontWeight: 700 }}>Next Lessons</h3>
            </div>
            <div className="space-y-3">
              {nextRecommendations.length === 0 ? (
                <div style={{ color: 'var(--cp-text-muted)', fontSize: '0.9rem' }}>Complete your current phase to unlock the next milestones.</div>
              ) : (
                nextRecommendations.map((l, idx) => (
                  <div key={`${l.id}-${idx}`} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.25)' }}>
                      <Zap size={14} color="#a78bfa" />
                    </div>
                    <span style={{ color: 'var(--cp-text-primary)', fontSize: '0.85rem' }}>{l.title}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
