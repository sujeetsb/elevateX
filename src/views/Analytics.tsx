'use client';

import { useMemo } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, TrendingUp, Zap, Flame, Target, RefreshCw, AlertCircle, FileSearch } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  RadarChart, PolarGrid, PolarAngleAxis, Radar, BarChart, Bar, LineChart, Line, CartesianGrid,
} from 'recharts';
import { useGame } from '../components/GameContext';
import { useWeeklyStudyHours } from '@/lib/hooks/use-weekly-study-hours';
import { useProfileAnalytics } from '@/lib/hooks/use-profile-analytics';
import { getAtsMessage } from '@/lib/ats/messaging';
import { formatAtsDelta, formatAtsScore, hasAtsScore } from '@/lib/ats/display';

const tooltipStyle = {
  contentStyle: {
    background: 'var(--cp-bg-card-solid)',
    border: '1px solid var(--cp-border-accent)',
    borderRadius: '12px',
    color: 'var(--cp-text-primary)',
    fontSize: '0.8rem',
    fontFamily: "'Space Grotesk', sans-serif",
  },
};

function AnalyticsSkeleton() {
  return (
    <div className="app-page section-pad animate-pulse pt-6">
      <div className="rounded-2xl h-12 w-48 mb-6" style={{ background: 'var(--cp-bg-card)' }} />
      <div className="responsive-grid-2 gap-3 mb-5">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="rounded-2xl h-24" style={{ background: 'var(--cp-bg-card)' }} />
        ))}
      </div>
      {[1, 2, 3].map(i => (
        <div key={i} className="rounded-3xl h-40 mb-5" style={{ background: 'var(--cp-bg-card)' }} />
      ))}
    </div>
  );
}

export function Analytics() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromProfile = searchParams.get('from') === 'profile';
  const { isHydrating } = useGame();
  const {
    data: analytics,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useProfileAnalytics(!isHydrating);
  const {
    data: weeklyHours,
    isLoading: weeklyHoursLoading,
  } = useWeeklyStudyHours(!isHydrating);

  const goBack = () => {
    if (fromProfile) router.push('/app/profile');
    else if (typeof window !== 'undefined' && window.history.length > 1) router.back();
    else router.push('/app/dashboard');
  };

  const atsScore = analytics?.atsScore ?? null;
  const atsMsg = getAtsMessage(atsScore);
  const xp = analytics?.xp ?? 0;
  const streak = analytics?.streak ?? 0;
  const level = analytics?.level ?? 1;
  const levelName = analytics?.levelName ?? 'Explorer';
  const profileCompletion = analytics?.profileCompletion ?? 0;

  const radarData = useMemo(() => {
    const fromApi = analytics?.skillsRadar ?? [];
    return fromApi.length >= 3 ? fromApi : [];
  }, [analytics?.skillsRadar]);

  const xpTrend = analytics?.xpTrend?.length ? analytics.xpTrend : [{ label: 'Now', xp }];
  const atsTrend = analytics?.atsTrend?.length ? analytics.atsTrend : [];
  const careerReadiness = analytics?.careerReadiness?.length ? analytics.careerReadiness : [];

  if (isHydrating || isLoading) {
    return <AnalyticsSkeleton />;
  }

  if (isError) {
    return (
      <div className="app-page section-pad pt-6">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={goBack} className="w-9 h-9 rounded-xl flex items-center justify-center glass-card">
            <ArrowLeft size={18} color="#94a3b8" />
          </button>
          <h1 style={{ color: 'var(--cp-text-primary)', fontWeight: 700, fontSize: '1.2rem' }}>Analytics</h1>
        </div>
        <div className="glass-card rounded-3xl p-8 text-center">
          <AlertCircle size={32} className="mx-auto mb-3" color="#f43f5e" />
          <p style={{ color: 'var(--cp-text-primary)', fontWeight: 600, marginBottom: '8px' }}>Could not load analytics</p>
          <p style={{ color: 'var(--cp-text-muted)', fontSize: '0.85rem', marginBottom: '16px' }}>
            {(error as Error)?.message ?? 'Something went wrong. Please try again.'}
          </p>
          <button
            onClick={() => void refetch()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl"
            style={{ background: 'var(--cp-accent)', color: 'var(--cp-text-inverse)', fontWeight: 600, fontSize: '0.85rem' }}
          >
            <RefreshCw size={16} /> Retry
          </button>
        </div>
      </div>
    );
  }

  const stats = [
    {
      label: 'Total XP',
      value: xp.toLocaleString(),
      icon: <Zap size={16} color="#f59e0b" />,
      color: '#f59e0b',
      change: analytics?.xpTrend?.length && analytics.xpTrend.length > 1 ? 'Growing' : '—',
    },
    {
      label: 'Day Streak',
      value: `${streak}🔥`,
      icon: <Flame size={16} color="#f43f5e" />,
      color: '#f43f5e',
      change: streak > 0 ? 'Active' : 'Start today',
    },
    {
      label: 'ATS Score',
      value: hasAtsScore(atsScore) ? formatAtsScore(atsScore) : '—',
      icon: <Target size={16} color="#10b981" />,
      color: '#10b981',
      change: formatAtsDelta(analytics?.atsDelta),
    },
    {
      label: 'Career Ready',
      value: `${profileCompletion}%`,
      icon: <TrendingUp size={16} color="#06b6d4" />,
      color: '#06b6d4',
      change: careerReadiness.length > 1 ? 'Trending up' : '—',
    },
  ];

  return (
    <div className="app-page" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
      <div className="flex items-center gap-3 section-pad pt-5 pb-4">
        <button onClick={goBack} className="w-9 h-9 rounded-xl flex items-center justify-center glass-card">
          <ArrowLeft size={18} color="#94a3b8" />
        </button>
        <div className="flex-1">
          <h1 style={{ color: 'var(--cp-text-primary)', fontWeight: 700, fontSize: '1.2rem' }}>Analytics</h1>
          <p style={{ color: 'var(--cp-text-muted)', fontSize: '0.78rem' }}>Your career growth insights</p>
        </div>
        {isFetching && !isLoading && (
          <RefreshCw size={16} className="animate-spin" color="var(--cp-text-muted)" />
        )}
      </div>

      {!hasAtsScore(atsScore) && (
        <div className="section-pad mb-4">
          <div className="glass-card rounded-2xl p-4 flex items-start gap-3">
            <FileSearch size={20} color="#a78bfa" className="shrink-0 mt-0.5" />
            <div className="flex-1">
              <p style={{ color: 'var(--cp-text-primary)', fontWeight: 600, fontSize: '0.9rem' }}>ATS score not generated yet</p>
              <p style={{ color: 'var(--cp-text-muted)', fontSize: '0.78rem', marginTop: '4px' }}>{atsMsg.body}</p>
              <button
                onClick={() => router.push('/app/ats')}
                className="mt-3 px-3 py-1.5 rounded-lg text-sm font-semibold"
                style={{ background: 'var(--cp-accent)', color: 'var(--cp-text-inverse)' }}
              >
                Analyze Resume
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="section-pad mb-5">
        <div className="responsive-grid-2">
          {stats.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.07 }}
              className="glass-card rounded-2xl p-4"
            >
              <div className="flex items-center justify-between mb-2">
                {s.icon}
                <span style={{ color: '#10b981', fontSize: '0.72rem', fontWeight: 600 }}>{s.change}</span>
              </div>
              <div style={{ color: s.color, fontWeight: 800, fontSize: '1.3rem' }}>{s.value}</div>
              <div style={{ color: 'var(--cp-text-muted)', fontSize: '0.72rem' }}>{s.label}</div>
            </motion.div>
          ))}
        </div>
      </div>

      <div className="section-pad mb-5">
        <div className="glass-card rounded-3xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 style={{ color: 'var(--cp-text-primary)', fontWeight: 700 }}>Level {level} — {levelName}</h3>
              <p style={{ color: 'var(--cp-text-muted)', fontSize: '0.75rem' }}>XP to next level: {500 - (xp % 500)}</p>
            </div>
            <div className="level-badge rounded-xl px-3 py-1">
              <span style={{ color: 'var(--cp-text-inverse)', fontWeight: 700, fontSize: '0.85rem' }}>LVL {level}</span>
            </div>
          </div>
          <div className="rounded-full overflow-hidden" style={{ background: 'var(--cp-bg-elevated)', height: '10px' }}>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${(xp % 500) / 500 * 100}%` }}
              transition={{ duration: 1.5 }}
              className="xp-bar h-full rounded-full"
            />
          </div>
        </div>
      </div>

      <div className="section-pad mb-5">
        <div className="glass-card rounded-3xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 style={{ color: 'var(--cp-text-primary)', fontWeight: 700 }}>XP Progress</h3>
            <span style={{ color: 'var(--cp-text-muted)', fontSize: '0.75rem' }}>Recent activity</span>
          </div>
          {xpTrend.length > 1 ? (
            <ResponsiveContainer width="100%" height={140}>
              <AreaChart data={xpTrend}>
                <defs>
                  <linearGradient id="xpGradA" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="label" tick={{ fill: 'var(--cp-text-faint)', fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip {...tooltipStyle} formatter={(v: number) => [`${v} XP`, 'Total XP']} />
                <Area type="monotone" dataKey="xp" stroke="#7c3aed" strokeWidth={2.5} fill="url(#xpGradA)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <p style={{ color: 'var(--cp-text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '24px 0' }}>
              Complete courses and profile tasks to build your XP history.
            </p>
          )}
        </div>
      </div>

      {atsTrend.length > 0 && (
        <div className="section-pad mb-5">
          <div className="glass-card rounded-3xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 style={{ color: 'var(--cp-text-primary)', fontWeight: 700 }}>ATS Score Trend</h3>
              <span style={{ color: '#10b981', fontSize: '0.75rem' }}>{formatAtsDelta(analytics?.atsDelta)}</span>
            </div>
            <ResponsiveContainer width="100%" height={120}>
              <LineChart data={atsTrend}>
                <CartesianGrid stroke="var(--cp-border)" strokeDasharray="3 3" />
                <XAxis dataKey="label" tick={{ fill: 'var(--cp-text-faint)', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} tick={{ fill: 'var(--cp-text-faint)', fontSize: 10 }} axisLine={false} tickLine={false} width={28} />
                <Tooltip {...tooltipStyle} formatter={(v: number) => [`${v}/100`, 'ATS Score']} />
                <Line type="monotone" dataKey="score" stroke="#10b981" strokeWidth={2.5} dot={{ fill: '#10b981', r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="section-pad mb-5">
        <div className="glass-card rounded-3xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 style={{ color: 'var(--cp-text-primary)', fontWeight: 700 }}>Career Readiness</h3>
          </div>
          {careerReadiness.length > 1 ? (
            <ResponsiveContainer width="100%" height={120}>
              <LineChart data={careerReadiness}>
                <XAxis dataKey="label" tick={{ fill: 'var(--cp-text-faint)', fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip {...tooltipStyle} formatter={(v: number) => [`${v}%`, 'Readiness']} />
                <Line type="monotone" dataKey="score" stroke="#10b981" strokeWidth={2.5} dot={{ fill: '#10b981', r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p style={{ color: 'var(--cp-text-muted)', fontSize: '0.85rem' }}>Current readiness: {profileCompletion}% — upload resume and complete courses to improve.</p>
          )}
        </div>
      </div>

      <div className="section-pad mb-5">
        <div className="glass-card rounded-3xl p-5">
          <h3 style={{ color: 'var(--cp-text-primary)', fontWeight: 700, marginBottom: '4px' }}>Skill Mastery</h3>
          {radarData.length >= 3 ? (
            <ResponsiveContainer width="100%" height={200}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="var(--cp-border)" />
                <PolarAngleAxis dataKey="skill" tick={{ fill: 'var(--cp-text-muted)', fontSize: 10 }} />
                <Radar name="Skills" dataKey="value" stroke="#7c3aed" fill="#7c3aed" fillOpacity={0.28} />
              </RadarChart>
            </ResponsiveContainer>
          ) : (
            <p style={{ color: 'var(--cp-text-muted)', fontSize: '0.85rem', padding: '16px 0' }}>
              Add skills to your profile or upload a resume to see skill mastery.
            </p>
          )}
          {(analytics?.skillsGap?.length ?? 0) > 0 && (
            <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--cp-border)' }}>
              <p style={{ color: 'var(--cp-text-muted)', fontSize: '0.72rem', marginBottom: '8px' }}>Skill gaps to close</p>
              <div className="flex flex-wrap gap-2">
                {analytics!.skillsGap.map(skill => (
                  <span key={skill} className="px-2 py-1 rounded-lg text-xs" style={{ background: 'var(--cp-bg-elevated)', color: 'var(--cp-text-secondary)' }}>
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {(analytics?.salaryTrend?.length ?? 0) > 0 && (
        <div className="section-pad mb-5">
          <div className="glass-card rounded-3xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 style={{ color: 'var(--cp-text-primary)', fontWeight: 700 }}>Salary Growth</h3>
              <span style={{ color: 'var(--cp-text-muted)', fontSize: '0.75rem' }}>
                {analytics?.salary.currency}/{analytics?.salary.goalCurrency}
              </span>
            </div>
            <ResponsiveContainer width="100%" height={140}>
              <LineChart data={analytics!.salaryTrend}>
                <CartesianGrid stroke="var(--cp-border)" strokeDasharray="3 3" />
                <XAxis dataKey="label" tick={{ fill: 'var(--cp-text-faint)', fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip {...tooltipStyle} formatter={(v: number, name: string) => [v ? v.toLocaleString() : '—', name === 'current' ? 'Current' : 'Goal']} />
                <Line type="monotone" dataKey="current" stroke="#06b6d4" strokeWidth={2.5} dot={{ fill: '#06b6d4', r: 3 }} name="Current" />
                <Line type="monotone" dataKey="goal" stroke="#a78bfa" strokeWidth={2} strokeDasharray="4 4" dot={{ fill: '#a78bfa', r: 3 }} name="Goal" />
              </LineChart>
            </ResponsiveContainer>
            <div className="flex items-center justify-center gap-6 mt-2">
              <div className="flex items-center gap-2">
                <div className="w-3 h-0.5 rounded" style={{ background: '#06b6d4' }} />
                <span style={{ color: 'var(--cp-text-muted)', fontSize: '0.72rem' }}>Current salary</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-0.5 rounded border-dashed" style={{ background: '#a78bfa' }} />
                <span style={{ color: 'var(--cp-text-muted)', fontSize: '0.72rem' }}>Salary goal</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {(analytics?.skillGrowthTrend?.length ?? 0) > 1 && (
        <div className="section-pad mb-5">
          <div className="glass-card rounded-3xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 style={{ color: 'var(--cp-text-primary)', fontWeight: 700 }}>Skill Growth Timeline</h3>
              <span style={{ color: 'var(--cp-text-muted)', fontSize: '0.75rem' }}>From profile history</span>
            </div>
            <ResponsiveContainer width="100%" height={150}>
              <LineChart data={analytics!.skillGrowthTrend}>
                <XAxis dataKey="month" tick={{ fill: 'var(--cp-text-faint)', fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip {...tooltipStyle} />
                {Object.keys(analytics!.skillGrowthTrend[0] ?? {})
                  .filter(k => k !== 'month')
                  .slice(0, 4)
                  .map((key, idx) => (
                    <Line
                      key={key}
                      type="monotone"
                      dataKey={key}
                      stroke={['#7c3aed', '#06b6d4', '#10b981', '#f59e0b'][idx]}
                      strokeWidth={2}
                      dot={false}
                      name={key}
                    />
                  ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="section-pad mb-5">
        <div className="responsive-grid-2 gap-3">
          <div className="glass-card rounded-2xl p-4">
            <h4 style={{ color: 'var(--cp-text-primary)', fontWeight: 700, fontSize: '0.9rem', marginBottom: '8px' }}>Courses</h4>
            <div style={{ color: '#a78bfa', fontWeight: 800, fontSize: '1.4rem' }}>{analytics?.courses.completed ?? 0}/{analytics?.courses.total ?? 0}</div>
            <p style={{ color: 'var(--cp-text-muted)', fontSize: '0.72rem' }}>Completed · {analytics?.courses.inProgress ?? 0} in progress · avg {analytics?.courses.avgProgress ?? 0}%</p>
          </div>
          <div className="glass-card rounded-2xl p-4">
            <h4 style={{ color: 'var(--cp-text-primary)', fontWeight: 700, fontSize: '0.9rem', marginBottom: '8px' }}>Job Applications</h4>
            <div style={{ color: '#06b6d4', fontWeight: 800, fontSize: '1.4rem' }}>{analytics?.jobApplications.total ?? 0}</div>
            <p style={{ color: 'var(--cp-text-muted)', fontSize: '0.72rem' }}>
              {analytics?.jobApplications.interview ?? 0} interviews · {analytics?.jobApplications.offer ?? 0} offers
            </p>
          </div>
        </div>
      </div>

      <div className="section-pad mb-5">
        <div className="glass-card rounded-3xl p-5">
          <h3 style={{ color: 'var(--cp-text-primary)', fontWeight: 700, marginBottom: '8px' }}>Roadmap Progress</h3>
          {analytics?.roadmap.hasRoadmap ? (
            <>
              <div style={{ color: '#7c3aed', fontWeight: 800, fontSize: '1.3rem' }}>{analytics.roadmap.progressPct}%</div>
              <p style={{ color: 'var(--cp-text-muted)', fontSize: '0.78rem' }}>
                {analytics.roadmap.completedResources} of {analytics.roadmap.totalResources} resources completed
              </p>
            </>
          ) : (
            <p style={{ color: 'var(--cp-text-muted)', fontSize: '0.85rem' }}>No active roadmap yet. Generate one from the Roadmap page.</p>
          )}
        </div>
      </div>

      <div className="section-pad mb-5">
        <div className="glass-card rounded-3xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 style={{ color: 'var(--cp-text-primary)', fontWeight: 700 }}>Weekly Study Hours</h3>
            <span style={{ color: 'var(--cp-text-muted)', fontSize: '0.75rem' }}>
              Avg: {weeklyHoursLoading ? '…' : `${weeklyHours?.averageHoursPerDay ?? 0} hrs/day`}
            </span>
          </div>
          {(weeklyHours?.days?.length ?? 0) > 0 ? (
            <ResponsiveContainer width="100%" height={120}>
              <BarChart data={weeklyHours!.days} barSize={24}>
                <XAxis dataKey="day" tick={{ fill: 'var(--cp-text-faint)', fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip {...tooltipStyle} formatter={(v: number) => [`${v} hrs`, 'Study time']} />
                <Bar dataKey="hours" fill="#7c3aed" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p style={{ color: 'var(--cp-text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '20px 0' }}>
              No study activity recorded this week yet.
            </p>
          )}
        </div>
      </div>

      {(analytics?.resumeSuggestions?.length ?? 0) > 0 && (
        <div className="section-pad mb-6">
          <div className="glass-card rounded-3xl p-5">
            <h3 style={{ color: 'var(--cp-text-primary)', fontWeight: 700, marginBottom: '12px' }}>Resume Suggestions</h3>
            <ul className="space-y-2">
              {analytics!.resumeSuggestions.map((tip, i) => (
                <li key={i} style={{ color: 'var(--cp-text-secondary)', fontSize: '0.82rem' }}>• {tip}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
