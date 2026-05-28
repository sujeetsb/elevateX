'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import { Bell, Moon, Sun, Monitor, Flame, Zap, Target, TrendingUp, ChevronRight, Star, Brain, ArrowUpRight } from 'lucide-react';
import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer, AreaChart, Area, Tooltip, XAxis } from 'recharts';
import { useGame } from '../components/GameContext';
import { useTheme } from '../components/ThemeContext';
import { SalaryIntelligence } from '../components/SalaryIntelligence';
import { listRecentResumes, listOptimizationHistory, getTemplateUsageStats } from '../lib/resume/storage';
import type { OptimizationHistoryEntry, SavedResumeMeta } from '../lib/resume/types';
import { getAtsDashboardInsight, getAtsActiveInsight, getAtsMessage } from '@/lib/ats/messaging';
import { formatAtsScore, hasAtsScore } from '@/lib/ats/display';
import { SubscriptionUpgradeModal } from '../components/SubscriptionUpgradeModal';
import { isProTierClient } from '@/lib/subscription/tier';
import { getTemplateMeta } from '../lib/resume/templates';
import { useResumesMeta } from '@/lib/hooks/use-salary-insights';
import { useProfileInsights } from '@/lib/hooks/use-profile-insights';
import { buildSkillRadarFromInsights } from '@/lib/insights/normalize';

/** DB resume row (lightweight) returned by GET /api/v1/resumes */
interface DbResumeMeta {
  id: string;
  title: string;
  parseStatus: string;
  parsedJson?: Record<string, unknown> | null;
  atsScore: number | null;
  updatedAt: string;
  createdAt: string;
}


const weeklyData = [
  { day: 'Mon', xp: 120 }, { day: 'Tue', xp: 280 }, { day: 'Wed', xp: 180 },
  { day: 'Thu', xp: 350 }, { day: 'Fri', xp: 220 }, { day: 'Sat', xp: 400 }, { day: 'Sun', xp: 310 },
];

const skillRadarFallback = [
  { skill: 'React', value: 88 }, { skill: 'TypeScript', value: 75 }, { skill: 'Node.js', value: 60 },
  { skill: 'CSS', value: 85 }, { skill: 'Testing', value: 45 }, { skill: 'DevOps', value: 35 },
];

const heatmapData = Array.from({ length: 35 }, (_, i) => ({
  day: i,
  value: Math.random() > 0.4 ? Math.floor(Math.random() * 4) + 1 : 0,
}));

function ProfileRing({ completion }: { completion: number }) {
  const r = 42;
  const circ = 2 * Math.PI * r;
  const dash = (completion / 100) * circ;
  return (
    <svg width="100" height="100" viewBox="0 0 100 100" className="progress-ring">
      <circle cx="50" cy="50" r={r} fill="none" stroke="var(--cp-border)" strokeWidth="8" />
      <motion.circle
        cx="50" cy="50" r={r} fill="none"
        stroke="url(#ringGrad)" strokeWidth="8"
        strokeDasharray={circ}
        initial={{ strokeDashoffset: circ }}
        animate={{ strokeDashoffset: circ - dash }}
        transition={{ duration: 1.5, ease: 'easeOut' }}
        strokeLinecap="round"
      />
      <defs>
        <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#7c3aed" />
          <stop offset="100%" stopColor="#06b6d4" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function DashboardSkeleton() {
  return (
    <div className="app-page section-pad" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
      <div className="animate-pulse space-y-4 pt-6">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="rounded-3xl h-28" style={{ background: 'var(--cp-bg-card)' }} />
        ))}
      </div>
    </div>
  );
}

export function Dashboard() {
  const router = useRouter();
  const { user, xp, level, levelName, currentLevelXp, totalXpForNextLevel, streak, profileCompletion, atsScore, badges, courses, jobs, claimDailyBonus, alreadyClaimedToday, isHydrating } = useGame();
  const { theme, setTheme } = useTheme();
  const [claimedDaily, setClaimedDaily] = useState(false);
  const [dailyClaimBusy, setDailyClaimBusy] = useState(false);
  const [dailyClaimError, setDailyClaimError] = useState<string | null>(null);
  const [recentResumes, setRecentResumes] = useState<SavedResumeMeta[]>([]);
  const [dbResumes, setDbResumes] = useState<DbResumeMeta[]>([]);
  const [dbResumesLoading, setDbResumesLoading] = useState(true);
  const { data: resumesMeta = [], isLoading: resumesMetaLoading } = useResumesMeta(Boolean(user.email));
  const { data: profileInsights } = useProfileInsights(user.profileVersion, Boolean(user.email));
  const [optHistory, setOptHistory] = useState<OptimizationHistoryEntry[]>([]);
  const [tplStats, setTplStats] = useState<Record<string, number>>({});

  // Sync server-driven claim state — server is source of truth; localStorage is a secondary cache.
  useEffect(() => {
    if (alreadyClaimedToday) {
      setClaimedDaily(true);
      return;
    }
    // Fall back to localStorage for instant UX on same device
    const key = user.email.trim().length > 0 ? `cp_daily_claim_v1_${encodeURIComponent(user.email)}` : '';
    if (!key) return;
    const today = new Date().toISOString().slice(0, 10);
    try {
      if (localStorage.getItem(`${key}_${today}`) === '1') setClaimedDaily(true);
    } catch {
      // ignore
    }
  }, [alreadyClaimedToday, user.email]);

  useEffect(() => {
    setRecentResumes(listRecentResumes(5));
    setOptHistory(listOptimizationHistory(8));
    setTplStats(getTemplateUsageStats());
  }, []);

  // DB resumes via React Query (shared cache with ATS studio)
  useEffect(() => {
    setDbResumesLoading(resumesMetaLoading);
    setDbResumes(resumesMeta.filter(r => r.parseStatus === 'COMPLETE'));
  }, [resumesMeta, resumesMetaLoading]);

  const skillRadarData = useMemo(() => {
    const fromInsights = buildSkillRadarFromInsights({
      userSkills: user.skills,
      skillsGap: profileInsights?.skillsGap ?? [],
    });
    return fromInsights.length >= 3 ? fromInsights : skillRadarFallback;
  }, [user.skills, profileInsights?.skillsGap]);

  const atsMsg = getAtsMessage(atsScore);
  const aiMessages = [
    `💡 You're only ${100 - profileCompletion}% away from unlocking Expert AI features!`,
    `🔥 ${streak} day streak! Keep going to earn the Week Warrior badge!`,
    `🎯 Add certifications to boost your profile by 10% and gain +150 XP!`,
    getAtsDashboardInsight(atsScore),
  ];
  const [aiMsgIndex] = useState(Math.floor(Math.random() * aiMessages.length));

  const earnedBadges = badges.filter(b => b.earnedAt);
  const atsInsight = getAtsActiveInsight(atsScore);
  const activeInsights = [
    ...(atsInsight ? [{ icon: atsInsight.icon, text: atsInsight.text, xp: 250, action: atsInsight.action }] : []),
    { icon: '🐙', text: 'Add GitHub portfolio to gain +150 XP', xp: 150, action: '/app/profile' },
    { icon: '📜', text: 'Add a certification to complete your profile', xp: 120, action: '/app/profile' },
  ];
  const [showSubscribe, setShowSubscribe] = useState(false);

  if (isHydrating) return <DashboardSkeleton />;

  return (
    <div className="app-page" style={{ fontFamily: "'Space Grotesk', sans-serif", paddingBottom: '8px' }}>
      {/* Header */}
      <div className="flex items-center justify-between p-5 pb-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center glow-purple"
            style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)' }}>
            <span style={{ fontSize: '1.1rem' }}>🚀</span>
          </div>
          <div>
            <div style={{ color: 'var(--cp-text-muted)', fontSize: '0.75rem' }}>Good morning,</div>
            <div style={{ color: 'var(--cp-text-primary)', fontWeight: 700, fontSize: '1rem' }}>{user.name}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Theme cycle button — visible on mobile (sidebar handles desktop) */}
          <button
            type="button"
            onClick={() => setTheme(theme === 'dark' ? 'light' : theme === 'light' ? 'system' : 'dark')}
            className="w-9 h-9 rounded-xl flex items-center justify-center glass-card lg:hidden transition-all"
            aria-label={`Switch theme (current: ${theme})`}
            title={`Theme: ${theme} — tap to cycle`}
          >
            {theme === 'light'
              ? <Sun size={17} color="#f59e0b" />
              : theme === 'system'
                ? <Monitor size={17} color="#94a3b8" />
                : <Moon size={17} color="#a78bfa" />}
          </button>
          <button onClick={() => router.push('/app/profile')} className="w-9 h-9 rounded-xl flex items-center justify-center overflow-hidden"
            style={{ background: 'linear-gradient(135deg, #7c3aed, #06b6d4)' }}>
            <span style={{ color: 'white', fontWeight: 700, fontSize: '0.9rem' }}>
              {user.name.charAt(0)}
            </span>
          </button>
        </div>
      </div>

      {/* Hero Card — Level & XP */}
      <div className="section-pad mb-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl p-5 relative overflow-hidden"
          style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.25), rgba(6,182,212,0.15))', border: '1px solid rgba(124,58,237,0.3)' }}
        >
          {/* Background decoration */}
          <div className="absolute top-0 right-0 w-32 h-32 rounded-full opacity-10"
            style={{ background: 'radial-gradient(circle, #a78bfa, transparent)', transform: 'translate(20%, -20%)' }} />

          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="level-badge rounded-lg px-2 py-0.5">
                  <span style={{ color: 'var(--cp-text-inverse)', fontWeight: 700, fontSize: '0.75rem' }}>LVL {level}</span>
                </div>
                <span style={{ color: '#a78bfa', fontWeight: 600, fontSize: '0.9rem' }}>{levelName}</span>
              </div>
              <div style={{ color: 'var(--cp-text-primary)', fontWeight: 700, fontSize: '1.6rem' }}>{xp.toLocaleString()} XP</div>
              <div style={{ color: 'var(--cp-text-muted)', fontSize: '0.78rem' }}>{totalXpForNextLevel - currentLevelXp} XP to Level {level + 1}</div>
            </div>
            <div className="flex items-center gap-2">
              <div className="streak-badge flex items-center gap-1.5 rounded-2xl px-3 py-2"
                style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)' }}>
                <Flame size={16} color="#f59e0b" />
                <span style={{ color: '#f59e0b', fontWeight: 700, fontSize: '0.9rem' }}>{streak}</span>
              </div>
            </div>
          </div>

          {/* XP Bar */}
          <div className="rounded-full overflow-hidden mb-2" style={{ background: 'var(--cp-bg-elevated)', height: '8px' }}>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${(currentLevelXp / totalXpForNextLevel) * 100}%` }}
              transition={{ duration: 1.5, ease: 'easeOut' }}
              className="xp-bar h-full rounded-full"
            />
          </div>
          <div className="flex justify-between">
            <span style={{ color: 'var(--cp-text-muted)', fontSize: '0.72rem' }}>{currentLevelXp} / {totalXpForNextLevel} XP</span>
            <span style={{ color: 'var(--cp-text-muted)', fontSize: '0.72rem' }}>Level {level + 1}: {getLevelName(level + 1)}</span>
          </div>

          {/* AI motivational message */}
          <div className="mt-4 rounded-2xl px-3 py-2.5 flex items-start gap-2"
            style={{ background: 'var(--cp-bg-card)', border: '1px solid var(--cp-border)' }}>
            <Brain size={15} color="#a78bfa" className="mt-0.5 shrink-0" />
            <p style={{ color: 'var(--cp-text-muted)', fontSize: '0.78rem', lineHeight: '1.4' }}>{aiMessages[aiMsgIndex]}</p>
          </div>
        </motion.div>
      </div>

      {/* Daily Claim */}
      {!claimedDaily && (
        <div className="section-pad mb-4">
          {dailyClaimError ? (
            <p className="mb-2 text-sm text-rose-400" role="alert">
              {dailyClaimError}
            </p>
          ) : null}
          <motion.button
            type="button"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            whileTap={{ scale: dailyClaimBusy ? 1 : 0.97 }}
            disabled={dailyClaimBusy}
            onClick={() => {
              void (async () => {
                setDailyClaimError(null);
                setDailyClaimBusy(true);
                const r = await claimDailyBonus();
                setDailyClaimBusy(false);
                if (r.error) {
                  setDailyClaimError(r.error);
                  return;
                }
                setClaimedDaily(true);
                const today = new Date().toISOString().slice(0, 10);
                try {
                  const storageKey = user.email.trim().length > 0 ? `cp_daily_claim_v1_${encodeURIComponent(user.email)}` : '';
                  if (storageKey) localStorage.setItem(`${storageKey}_${today}`, '1');
                } catch {
                  // ignore
                }
              })();
            }}
            className="w-full rounded-2xl p-4 flex items-center gap-3 disabled:opacity-60 cursor-pointer disabled:cursor-wait"
            style={{ background: 'linear-gradient(135deg, rgba(245,158,11,0.15), rgba(251,191,36,0.08))', border: '1px solid rgba(245,158,11,0.3)' }}
          >
            <div className="text-2xl">🎁</div>
            <div className="flex-1 text-left">
              <div style={{ color: '#fbbf24', fontWeight: 600, fontSize: '0.9rem' }}>
                {dailyClaimBusy ? 'Claiming…' : 'Claim Daily Reward'}
              </div>
              <div style={{ color: 'var(--cp-text-muted)', fontSize: '0.78rem' }}>
                {streak > 0 ? `Day ${streak} of your streak!` : 'Start your streak today!'}
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Zap size={14} color="#f59e0b" />
              <span style={{ color: '#f59e0b', fontWeight: 700, fontSize: '0.9rem' }}>+25 XP</span>
            </div>
          </motion.button>
        </div>
      )}

      {/* Stats row */}
      <div className="section-pad mb-4">
        <div className="responsive-grid-3">
          {[
            { label: 'ATS Score', value: hasAtsScore(atsScore) ? formatAtsScore(atsScore) : '—', unit: hasAtsScore(atsScore) ? '/100' : '', icon: '🎯', color: atsMsg.band === 'excellent' ? '#10b981' : atsMsg.band === 'good' ? '#06b6d4' : '#f59e0b', path: '/app/ats' },
            { label: 'Job Match', value: '87', unit: '%', icon: '💼', color: '#06b6d4', path: '/app/jobs' },
            { label: 'Courses', value: `${courses.length}`, unit: '', icon: '📚', color: '#a78bfa', path: '/app/courses' },
          ].map(stat => (
            <button key={stat.label} onClick={() => router.push(stat.path)} className="glass-card rounded-2xl p-3 text-left">
              <div style={{ fontSize: '1.1rem', marginBottom: '6px' }}>{stat.icon}</div>
              <div style={{ color: stat.color, fontWeight: 700, fontSize: '1.1rem' }}>
                {stat.value}<span style={{ fontSize: '0.7rem', color: 'var(--cp-text-muted)' }}>{stat.unit}</span>
              </div>
              <div style={{ color: 'var(--cp-text-muted)', fontSize: '0.72rem' }}>{stat.label}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Job Matches — center prominence */}
      <div className="section-pad mb-4">
        <div className="flex items-center justify-between mb-3">
          <h3 style={{ color: 'var(--cp-text-primary)', fontWeight: 700 }}>Top Job Matches</h3>
          <button onClick={() => router.push('/app/jobs')} style={{ color: '#a78bfa', fontSize: '0.8rem', background: 'none', border: 'none', cursor: 'pointer' }}>See all →</button>
        </div>
        <div className="space-y-3">
          {(jobs.length > 0
            ? jobs.slice(0, 3).map(job => ({
              company: job.company,
              role: job.title,
              match: job.matchPercent,
              logo: job.logo || '🏢',
              salary: job.salary || 'Salary not listed',
            }))
            : [
              { company: 'Notion', role: 'Frontend Engineer', match: 95, logo: '📝', salary: '$130k–$170k' },
              { company: 'Vercel', role: 'React Developer', match: 92, logo: '▲', salary: '$140k–$180k' },
            ]).map((job, i) => (
            <motion.button
              key={i}
              onClick={() => router.push('/app/jobs')}
              className="w-full glass-card rounded-2xl p-4 flex items-center gap-3 text-left"
              whileTap={{ scale: 0.98 }}
            >
              <div className="w-10 h-10 rounded-xl flex items-center justify-center glass-card text-lg">{job.logo}</div>
              <div className="flex-1">
                <div style={{ color: 'var(--cp-text-primary)', fontWeight: 600, fontSize: '0.85rem' }}>{job.role}</div>
                <div style={{ color: 'var(--cp-text-muted)', fontSize: '0.75rem' }}>{job.company} · {job.salary}</div>
              </div>
              <div className="text-right">
                <div style={{ color: '#10b981', fontWeight: 700, fontSize: '0.9rem' }}>{job.match}%</div>
                <div style={{ color: 'var(--cp-text-faint)', fontSize: '0.68rem' }}>match</div>
              </div>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Profile Strength */}
      <div className="section-pad mb-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass-card rounded-3xl p-5"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 style={{ color: 'var(--cp-text-primary)', fontWeight: 700 }}>Profile Strength</h3>
            <button onClick={() => router.push('/app/profile')} style={{ color: '#a78bfa', fontSize: '0.8rem', background: 'none', border: 'none', cursor: 'pointer' }}>
              Boost →
            </button>
          </div>
          <div className="flex items-center gap-5">
            <div className="relative">
              <ProfileRing completion={profileCompletion} />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <div className="text-gradient" style={{ fontWeight: 700, fontSize: '1rem' }}>{profileCompletion}%</div>
                </div>
              </div>
            </div>
            <div className="flex-1 space-y-2">
              {[
                { label: 'Resume', done: true, xp: 20 },
                { label: 'LinkedIn', done: !!user.linkedIn, xp: 10 },
                { label: 'GitHub', done: !!user.github, xp: 10 },
                { label: 'Certifications', done: user.certifications.length > 0, xp: 10 },
                { label: 'ATS Optimized', done: user.atsOptimized, xp: 15 },
              ].map(item => (
                <div key={item.label} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full flex items-center justify-center"
                      style={{ background: item.done ? '#10b981' : 'rgba(255,255,255,0.1)' }}>
                      {item.done && <span style={{ color: 'white', fontSize: '7px' }}>✓</span>}
                    </div>
                    <span style={{ color: item.done ? 'var(--cp-text-muted)' : 'var(--cp-text-primary)', fontSize: '0.78rem' }}>{item.label}</span>
                  </div>
                  <span style={{ color: item.done ? '#475569' : '#f59e0b', fontSize: '0.72rem' }}>
                    {item.done ? 'Done' : `+${item.xp}%`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>

      {/* Unified Salary Intelligence */}
      <div className="section-pad mb-4">
        <SalaryIntelligence
          compact
          userCurrentSalary={user.currentSalary}
          salaryCurrency={user.salaryCurrency}
          country={user.country}
          profileVersion={user.profileVersion}
          isPro={isProTierClient(user.subscriptionTier)}
        />
      </div>

      {/* Resume library & AI history */}
      <div className="section-pad mb-4">
        <div className="flex items-center justify-between mb-3">
          <h3 style={{ color: 'var(--cp-text-primary)', fontWeight: 700 }}>Resume studio</h3>
          <button type="button" onClick={() => router.push('/app/ats')} style={{ color: '#a78bfa', fontSize: '0.8rem', background: 'none', border: 'none', cursor: 'pointer' }}>
            Open builder →
          </button>
        </div>
        <div className="glass-card rounded-3xl p-5 mb-3">
          <div className="flex items-center justify-between mb-2">
            <span style={{ color: 'var(--cp-text-muted)', fontSize: '0.78rem', fontWeight: 600 }}>
              {dbResumes.length > 0 ? 'Uploaded resumes' : 'Recently saved'}
            </span>
            <span style={{ color: 'var(--cp-text-faint)', fontSize: '0.72rem' }}>
              {dbResumes.length > 0 ? `${dbResumes.length} in library` : `${recentResumes.length} on device`}
            </span>
          </div>

          {dbResumesLoading ? (
            <div className="space-y-2">
              {[1, 2].map(i => (
                <div key={i} className="h-10 rounded-xl animate-pulse" style={{ background: 'var(--cp-bg-elevated)' }} />
              ))}
            </div>
          ) : dbResumes.length > 0 ? (
            <div className="space-y-2">
              {dbResumes.slice(0, 5).map(r => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => router.push('/app/ats')}
                  className="w-full flex items-center justify-between rounded-xl px-3 py-2 text-left"
                  style={{ background: 'var(--cp-bg-card)', border: 'none', cursor: 'pointer' }}
                >
                  <div>
                    <div style={{ color: 'var(--cp-text-primary)', fontSize: '0.82rem', fontWeight: 600 }}>{r.title || 'Resume'}</div>
                    <div style={{ color: 'var(--cp-text-muted)', fontSize: '0.72rem' }}>
                      {r.atsScore != null ? `ATS ${r.atsScore}` : 'Parsed'} · {new Date(r.updatedAt).toLocaleDateString()}
                    </div>
                  </div>
                  <span className="text-[0.65rem] font-bold px-2 py-0.5 rounded shrink-0 ml-2" style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981' }}>
                    ✓ Parsed
                  </span>
                </button>
              ))}
            </div>
          ) : recentResumes.length > 0 ? (
            <div className="space-y-2">
              {recentResumes.map(r => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => router.push('/app/ats')}
                  className="w-full flex items-center justify-between rounded-xl px-3 py-2 text-left"
                  style={{ background: 'var(--cp-bg-card)', border: 'none', cursor: 'pointer' }}
                >
                  <div>
                    <div style={{ color: 'var(--cp-text-primary)', fontSize: '0.82rem', fontWeight: 600 }}>{r.name}</div>
                    <div style={{ color: 'var(--cp-text-muted)', fontSize: '0.72rem' }}>
                      {getTemplateMeta(r.templateId).name} · ATS {r.atsScoreSnapshot} · {new Date(r.updatedAt).toLocaleDateString()}
                    </div>
                  </div>
                  <span className="text-[0.65rem] font-bold px-2 py-0.5 rounded" style={{ background: 'rgba(124,58,237,0.2)', color: '#c4b5fd' }}>
                    Saved
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="text-center py-2">
              <div style={{ fontSize: '1.4rem', marginBottom: '6px' }}>📄</div>
              <p style={{ color: 'var(--cp-text-muted)', fontSize: '0.82rem', margin: '0 0 10px' }}>
                No resume yet. Upload one to get started.
              </p>
              <button
                type="button"
                onClick={() => router.push('/app/ats')}
                className="rounded-xl px-4 py-2"
                style={{ background: 'rgba(124,58,237,0.2)', color: '#a78bfa', border: '1px solid rgba(124,58,237,0.3)', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}
              >
                Upload Resume →
              </button>
            </div>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="glass-card rounded-2xl p-4">
            <div style={{ color: 'var(--cp-text-muted)', fontSize: '0.75rem', fontWeight: 600, marginBottom: 8 }}>AI optimization history</div>
            {optHistory.length === 0 ? (
              <p style={{ color: 'var(--cp-text-muted)', fontSize: '0.78rem', margin: 0 }}>Runs appear here after polish, rewrite, or generate.</p>
            ) : (
              <ul className="space-y-2" style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                {optHistory.map(h => (
                  <li key={h.id} style={{ color: 'var(--cp-text-muted)', fontSize: '0.78rem' }}>
                    <span style={{ color: 'var(--cp-text-primary)', fontWeight: 600 }}>{h.label}</span> · {h.atsBefore} → {h.atsAfter} · {getTemplateMeta(h.templateId).name}
                    <div style={{ color: 'var(--cp-text-faint)', fontSize: '0.68rem' }}>{new Date(h.createdAt).toLocaleString()}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="glass-card rounded-2xl p-4">
            <div style={{ color: 'var(--cp-text-muted)', fontSize: '0.75rem', fontWeight: 600, marginBottom: 8 }}>Template usage</div>
            {Object.keys(tplStats).length === 0 ? (
              <p style={{ color: 'var(--cp-text-muted)', fontSize: '0.78rem', margin: 0 }}>Save a resume to start tracking template picks.</p>
            ) : (
              <div className="space-y-1">
                {Object.entries(tplStats)
                  .sort((a, b) => b[1] - a[1])
                  .map(([id, count]) => (
                    <div key={id} className="flex justify-between text-[0.78rem]" style={{ color: 'var(--cp-text-muted)' }}>
                      <span>{getTemplateMeta(id as SavedResumeMeta['templateId']).name}</span>
                      <span style={{ color: '#a78bfa', fontWeight: 700 }}>{count}</span>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      </div>



      {/* AI Insights */}
      <div className="section-pad mb-4">
        <div className="flex items-center justify-between mb-3">
          <h3 style={{ color: 'var(--cp-text-primary)', fontWeight: 700 }}>AI Insights</h3>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span style={{ color: 'var(--cp-text-muted)', fontSize: '0.75rem' }}>Live</span>
          </div>
        </div>
        <div className="space-y-3">
          {activeInsights.map((insight, i) => (
            <motion.button
              key={i}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 * i }}
              onClick={() => router.push(insight.action)}
              className="w-full glass-card rounded-2xl p-4 flex items-center gap-3 text-left"
              whileTap={{ scale: 0.98 }}
            >
              <div className="text-xl shrink-0">{insight.icon}</div>
              <div className="flex-1">
                <p style={{ color: 'var(--cp-text-primary)', fontSize: '0.82rem', lineHeight: '1.4' }}>{insight.text}</p>
              </div>
              <div className="shrink-0 text-right">
                <div style={{ color: '#f59e0b', fontWeight: 700, fontSize: '0.8rem' }}>+{insight.xp} XP</div>
                <ArrowUpRight size={14} color="#475569" />
              </div>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Weekly XP Chart */}
      <div className="section-pad mb-4">
        <div className="glass-card rounded-3xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 style={{ color: 'var(--cp-text-primary)', fontWeight: 700 }}>Weekly XP</h3>
            <span style={{ color: '#10b981', fontSize: '0.78rem' }}>↑ 24% vs last week</span>
          </div>
          <ResponsiveContainer width="100%" height={100}>
            <AreaChart data={weeklyData}>
              <defs>
                <linearGradient id="xpGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="day" tick={{ fill: 'var(--cp-text-faint)', fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: 'var(--cp-bg-card-solid)', border: '1px solid var(--cp-border-accent)', borderRadius: '12px', color: 'var(--cp-text-primary)', fontSize: '0.8rem' }}
                formatter={(v: number) => [`${v} XP`, '']}
              />
              <Area type="monotone" dataKey="xp" stroke="#7c3aed" strokeWidth={2} fill="url(#xpGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Skill Radar */}
      <div className="section-pad mb-4">
        <div className="glass-card rounded-3xl p-5">
          <div className="flex items-center justify-between mb-2">
            <h3 style={{ color: 'var(--cp-text-primary)', fontWeight: 700 }}>Skill Radar</h3>
            <button onClick={() => router.push('/app/analytics')} style={{ color: '#a78bfa', fontSize: '0.8rem', background: 'none', border: 'none', cursor: 'pointer' }}>View all →</button>
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <RadarChart data={skillRadarData}>
              <PolarGrid stroke="var(--cp-border)" />
              <PolarAngleAxis dataKey="skill" tick={{ fill: 'var(--cp-text-muted)', fontSize: 10 }} />
              <Radar name="Skills" dataKey="value" stroke="#7c3aed" fill="#7c3aed" fillOpacity={0.25} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Activity Heatmap */}
      <div className="section-pad mb-4">
        <div className="glass-card rounded-3xl p-5">
          <h3 style={{ color: 'var(--cp-text-primary)', fontWeight: 700, marginBottom: '12px' }}>Learning Streak</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
            {heatmapData.map((d) => (
              <div
                key={d.day}
                className="rounded-sm"
                style={{
                  height: '24px',
                  background: d.value === 0 ? 'var(--cp-bg-elevated)'
                    : d.value === 1 ? 'rgba(124,58,237,0.25)'
                      : d.value === 2 ? 'rgba(124,58,237,0.5)'
                        : d.value === 3 ? 'rgba(124,58,237,0.75)'
                          : '#7c3aed',
                }}
              />
            ))}
          </div>
          <div className="flex items-center justify-between mt-3">
            <span style={{ color: 'var(--cp-text-faint)', fontSize: '0.72rem' }}>5 weeks ago</span>
            <div className="flex items-center gap-2">
              <Flame size={12} color="#f59e0b" />
              <span style={{ color: '#f59e0b', fontSize: '0.72rem', fontWeight: 600 }}>{streak} day streak!</span>
            </div>
            <span style={{ color: 'var(--cp-text-faint)', fontSize: '0.72rem' }}>Today</span>
          </div>
        </div>
      </div>

      {/* Current Courses */}
      <div className="section-pad mb-4">
        <div className="flex items-center justify-between mb-3">
          <h3 style={{ color: 'var(--cp-text-primary)', fontWeight: 700 }}>My Courses</h3>
          <button onClick={() => router.push('/app/courses')} style={{ color: '#a78bfa', fontSize: '0.8rem', background: 'none', border: 'none', cursor: 'pointer' }}>See all →</button>
        </div>
        <div className="space-y-3">
          {courses.length === 0 ? (
            <div className="glass-card rounded-2xl p-4 text-center">
              <p style={{ color: 'var(--cp-text-muted)', fontSize: '0.85rem', marginBottom: '8px' }}>No courses yet — generate your first AI course.</p>
              <button type="button" onClick={() => router.push('/app/courses')} className="btn-primary text-sm px-4 py-2 rounded-xl">
                Browse Courses
              </button>
            </div>
          ) : (
            courses.slice(0, 2).map(course => (
            <motion.button
              key={course.id}
              onClick={() => router.push(`/app/courses/${course.id}`)}
              className="w-full glass-card rounded-2xl p-4 flex items-center gap-3 text-left"
              whileTap={{ scale: 0.98 }}
            >
              <div className="text-2xl">{course.thumbnail}</div>
              <div className="flex-1 min-w-0">
                <div style={{ color: 'var(--cp-text-primary)', fontWeight: 600, fontSize: '0.85rem', marginBottom: '2px' }} className="truncate">{course.title}</div>
                <div style={{ color: 'var(--cp-text-muted)', fontSize: '0.75rem', marginBottom: '6px' }}>{course.difficulty} · {course.estimatedDays} days</div>
                <div className="rounded-full overflow-hidden" style={{ background: 'var(--cp-bg-elevated)', height: '4px' }}>
                  <div className="xp-bar h-full rounded-full" style={{ width: `${course.progress}%` }} />
                </div>
              </div>
              <div className="text-right shrink-0">
                <div style={{ color: '#a78bfa', fontWeight: 700, fontSize: '0.9rem' }}>{course.progress}%</div>
                <ChevronRight size={14} color="#475569" />
              </div>
            </motion.button>
            ))
          )}
        </div>
      </div>

      {/* Trophy Showcase */}
      <div className="section-pad mb-4">
        <div className="flex items-center justify-between mb-3">
          <h3 style={{ color: 'var(--cp-text-primary)', fontWeight: 700 }}>Badges Earned</h3>
          <button onClick={() => router.push('/app/profile')} style={{ color: '#a78bfa', fontSize: '0.8rem', background: 'none', border: 'none', cursor: 'pointer' }}>All badges →</button>
        </div>
        <div className="glass-card rounded-3xl p-4">
          <div className="flex gap-3">
            {earnedBadges.slice(0, 4).map(badge => (
              <div key={badge.id} className="flex flex-col items-center gap-1.5">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
                  style={{
                    background: badge.rarity === 'legendary' ? 'linear-gradient(135deg, #f59e0b, #fbbf24)' :
                      badge.rarity === 'epic' ? 'linear-gradient(135deg, #7c3aed, #a78bfa)' :
                        badge.rarity === 'rare' ? 'linear-gradient(135deg, #06b6d4, #0891b2)' :
                          'rgba(255,255,255,0.1)',
                    boxShadow: badge.rarity === 'legendary' ? '0 0 15px rgba(245,158,11,0.4)' :
                      badge.rarity === 'epic' ? '0 0 15px rgba(124,58,237,0.4)' : 'none',
                  }}>
                  <span style={{ fontSize: '1.3rem' }}>{badge.emoji}</span>
                </div>
                <span style={{ color: 'var(--cp-text-muted)', fontSize: '0.6rem', textAlign: 'center', maxWidth: '48px' }}>{badge.name}</span>
              </div>
            ))}
            <div className="flex flex-col items-center justify-center gap-1.5 flex-1">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
                style={{ background: 'var(--cp-bg-card)', border: '2px dashed rgba(124,58,237,0.3)' }}>
                <span style={{ color: 'var(--cp-text-faint)', fontSize: '1.2rem' }}>+</span>
              </div>
              <span style={{ color: 'var(--cp-text-faint)', fontSize: '0.6rem', textAlign: 'center' }}>{badges.filter(b => !b.earnedAt).length} locked</span>
            </div>
          </div>
        </div>
      </div>

      {!isProTierClient(user.subscriptionTier) && (
        <div className="section-pad mb-4">
          <button
            type="button"
            onClick={() => setShowSubscribe(true)}
            className="w-full glass-card-purple rounded-2xl p-4 flex items-center justify-between text-left"
          >
            <div>
              <div style={{ color: 'var(--cp-text-primary)', fontWeight: 600, fontSize: '0.9rem' }}>Upgrade to PRO</div>
              <div style={{ color: 'var(--cp-text-muted)', fontSize: '0.75rem' }}>Unlock apply, cover letters & job-tailored resumes</div>
            </div>
            <span style={{ color: '#a78bfa', fontWeight: 700, fontSize: '0.85rem' }}>Subscribe →</span>
          </button>
        </div>
      )}

      <SubscriptionUpgradeModal open={showSubscribe} onOpenChange={setShowSubscribe} />
    </div>
  );
}

function getLevelName(level: number): string {
  if (level >= 50) return 'AI Career Master';
  if (level >= 35) return 'Expert';
  if (level >= 20) return 'Professional';
  if (level >= 10) return 'Builder';
  if (level >= 5) return 'Learner';
  return 'Explorer';
}
