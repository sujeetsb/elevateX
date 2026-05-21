'use client';

import { motion } from 'motion/react';
import { ArrowLeft, TrendingUp, Zap, Flame, Target } from 'lucide-react';
import { useRouter } from 'next/navigation';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  RadarChart, PolarGrid, PolarAngleAxis, Radar, BarChart, Bar, LineChart, Line, CartesianGrid,
} from 'recharts';
import { useGame } from '../components/GameContext';

const xpGrowthData = [
  { week: 'W1', xp: 450, target: 600 }, { week: 'W2', xp: 820, target: 1200 },
  { week: 'W3', xp: 1450, target: 1800 }, { week: 'W4', xp: 1900, target: 2400 },
  { week: 'W5', xp: 2300, target: 3000 }, { week: 'W6', xp: 2750, target: 3600 },
  { week: 'W7', xp: 3250, target: 4200 },
];

const skillGrowthData = [
  { month: 'Nov', react: 70, ts: 55, node: 40, css: 78 },
  { month: 'Dec', react: 75, ts: 60, node: 45, css: 80 },
  { month: 'Jan', react: 80, ts: 68, node: 52, css: 83 },
  { month: 'Feb', react: 84, ts: 72, node: 57, css: 84 },
  { month: 'Mar', react: 87, ts: 74, node: 59, css: 85 },
  { month: 'Apr', react: 88, ts: 75, node: 60, css: 85 },
];

const weeklyHoursData = [
  { day: 'Mon', hours: 1.5 }, { day: 'Tue', hours: 3.2 }, { day: 'Wed', hours: 2.0 },
  { day: 'Thu', hours: 4.1 }, { day: 'Fri', hours: 2.5 }, { day: 'Sat', hours: 5.0 }, { day: 'Sun', hours: 3.5 },
];

const radarData = [
  { skill: 'React', value: 88 }, { skill: 'TypeScript', value: 75 },
  { skill: 'Node.js', value: 60 }, { skill: 'CSS', value: 85 },
  { skill: 'Testing', value: 45 }, { skill: 'DevOps', value: 35 },
];

const careerReadinessData = [
  { month: 'Nov', score: 42 }, { month: 'Dec', score: 51 },
  { month: 'Jan', score: 58 }, { month: 'Feb', score: 65 },
  { month: 'Mar', score: 70 }, { month: 'Apr', score: 76 },
];

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

export function Analytics() {
  const router = useRouter();
  const { xp, level, levelName, streak, atsScore, profileCompletion } = useGame();

  const stats = [
    { label: 'Total XP', value: xp.toLocaleString(), icon: <Zap size={16} color="#f59e0b" />, color: '#f59e0b', change: '+24%' },
    { label: 'Day Streak', value: `${streak}🔥`, icon: <Flame size={16} color="#f43f5e" />, color: '#f43f5e', change: '+8 days' },
    { label: 'ATS Score', value: `${atsScore}`, icon: <Target size={16} color="#10b981" />, color: '#10b981', change: '+5 pts' },
    { label: 'Career Ready', value: `${profileCompletion}%`, icon: <TrendingUp size={16} color="#06b6d4" />, color: '#06b6d4', change: '+12%' },
  ];

  return (
    <div className="app-page" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
      {/* Header */}
      <div className="flex items-center gap-3 section-pad pt-5 pb-4">
        <button onClick={() => router.push('/app/dashboard')} className="w-9 h-9 rounded-xl flex items-center justify-center glass-card">
          <ArrowLeft size={18} color="#94a3b8" />
        </button>
        <div>
          <h1 style={{ color: 'var(--cp-text-primary)', fontWeight: 700, fontSize: '1.2rem' }}>Analytics</h1>
          <p style={{ color: 'var(--cp-text-muted)', fontSize: '0.78rem' }}>Your career growth insights</p>
        </div>
      </div>

      {/* Key stats grid */}
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

      {/* Level progress */}
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
          <div className="flex justify-between mt-2">
            <span style={{ color: 'var(--cp-text-muted)', fontSize: '0.72rem' }}>Level {level}</span>
            <span style={{ color: '#a78bfa', fontSize: '0.72rem' }}>{xp % 500} / 500 XP</span>
            <span style={{ color: 'var(--cp-text-muted)', fontSize: '0.72rem' }}>Level {level + 1}</span>
          </div>
        </div>
      </div>

      {/* XP Growth Chart */}
      <div className="section-pad mb-5">
        <div className="glass-card rounded-3xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 style={{ color: 'var(--cp-text-primary)', fontWeight: 700 }}>XP Growth</h3>
            <span style={{ color: 'var(--cp-text-muted)', fontSize: '0.75rem' }}>Last 7 weeks</span>
          </div>
          <ResponsiveContainer width="100%" height={140}>
            <AreaChart data={xpGrowthData}>
              <defs>
                <linearGradient id="xpGradA" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="targetGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="week" tick={{ fill: 'var(--cp-text-faint)', fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip {...tooltipStyle} formatter={(v: number, name: string) => [`${v} XP`, name === 'xp' ? 'Your XP' : 'Target']} />
              <Area type="monotone" dataKey="target" stroke="#06b6d4" strokeWidth={1.5} fill="url(#targetGrad)" strokeDasharray="4 4" />
              <Area type="monotone" dataKey="xp" stroke="#7c3aed" strokeWidth={2.5} fill="url(#xpGradA)" />
            </AreaChart>
          </ResponsiveContainer>
          <div className="flex items-center justify-center gap-6 mt-2">
            <div className="flex items-center gap-2">
              <div className="w-3 h-0.5 rounded" style={{ background: '#7c3aed' }} />
              <span style={{ color: 'var(--cp-text-muted)', fontSize: '0.72rem' }}>Your XP</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-0.5 rounded border-dashed" style={{ background: '#06b6d4' }} />
              <span style={{ color: 'var(--cp-text-muted)', fontSize: '0.72rem' }}>Target</span>
            </div>
          </div>
        </div>
      </div>

      {/* Career Readiness */}
      <div className="section-pad mb-5">
        <div className="glass-card rounded-3xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 style={{ color: 'var(--cp-text-primary)', fontWeight: 700 }}>Career Readiness</h3>
            <span style={{ color: '#10b981', fontSize: '0.75rem' }}>↑ 34 pts in 6mo</span>
          </div>
          <ResponsiveContainer width="100%" height={120}>
            <LineChart data={careerReadinessData}>
              <XAxis dataKey="month" tick={{ fill: 'var(--cp-text-faint)', fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip {...tooltipStyle} formatter={(v: number) => [`${v}%`, 'Readiness']} />
              <Line type="monotone" dataKey="score" stroke="#10b981" strokeWidth={2.5} dot={{ fill: '#10b981', r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Skill Radar */}
      <div className="section-pad mb-5">
        <div className="glass-card rounded-3xl p-5">
          <h3 style={{ color: 'var(--cp-text-primary)', fontWeight: 700, marginBottom: '4px' }}>Skill Mastery</h3>
          <p style={{ color: 'var(--cp-text-muted)', fontSize: '0.75rem', marginBottom: '8px' }}>Current proficiency levels</p>
          <ResponsiveContainer width="100%" height={200}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="var(--cp-border)" />
              <PolarAngleAxis dataKey="skill" tick={{ fill: 'var(--cp-text-muted)', fontSize: 10 }} />
              <Radar name="Skills" dataKey="value" stroke="#7c3aed" fill="#7c3aed" fillOpacity={0.28} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Weekly Learning Hours */}
      <div className="section-pad mb-5">
        <div className="glass-card rounded-3xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 style={{ color: 'var(--cp-text-primary)', fontWeight: 700 }}>Weekly Study Hours</h3>
            <span style={{ color: 'var(--cp-text-muted)', fontSize: '0.75rem' }}>Avg: 3.1 hrs/day</span>
          </div>
          <ResponsiveContainer width="100%" height={120}>
            <BarChart data={weeklyHoursData} barSize={24}>
              <XAxis dataKey="day" tick={{ fill: 'var(--cp-text-faint)', fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip {...tooltipStyle} formatter={(v: number) => [`${v} hrs`, 'Study time']} />
              <Bar dataKey="hours" fill="#7c3aed" radius={[6, 6, 0, 0]}
                style={{ filter: 'drop-shadow(0 0 6px rgba(124,58,237,0.4))' }} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Skill Growth Lines */}
      <div className="section-pad mb-6">
        <div className="glass-card rounded-3xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 style={{ color: 'var(--cp-text-primary)', fontWeight: 700 }}>Skill Growth Timeline</h3>
            <span style={{ color: 'var(--cp-text-muted)', fontSize: '0.75rem' }}>6 months</span>
          </div>
          <ResponsiveContainer width="100%" height={150}>
            <LineChart data={skillGrowthData}>
              <XAxis dataKey="month" tick={{ fill: 'var(--cp-text-faint)', fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip {...tooltipStyle} />
              <Line type="monotone" dataKey="react" stroke="#7c3aed" strokeWidth={2} dot={false} name="React" />
              <Line type="monotone" dataKey="ts" stroke="#06b6d4" strokeWidth={2} dot={false} name="TypeScript" />
              <Line type="monotone" dataKey="node" stroke="#10b981" strokeWidth={2} dot={false} name="Node.js" />
              <Line type="monotone" dataKey="css" stroke="#f59e0b" strokeWidth={2} dot={false} name="CSS" />
            </LineChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap items-center gap-4 mt-2 justify-center">
            {[
              { name: 'React', color: '#7c3aed' },
              { name: 'TypeScript', color: '#06b6d4' },
              { name: 'Node.js', color: '#10b981' },
              { name: 'CSS', color: '#f59e0b' },
            ].map(s => (
              <div key={s.name} className="flex items-center gap-1.5">
                <div className="w-3 h-0.5 rounded" style={{ background: s.color }} />
                <span style={{ color: 'var(--cp-text-muted)', fontSize: '0.72rem' }}>{s.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
