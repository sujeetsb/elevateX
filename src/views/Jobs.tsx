'use client';

import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Search, MapPin, Clock, Zap, ChevronRight, Briefcase, TrendingUp, AlertCircle } from 'lucide-react';
import { useGame } from '../components/GameContext';
import { CareerDialog } from '../components/CareerDialog';

const filters = ['All', 'Remote', 'Full-time', 'High Match', 'Top Companies'];

export function Jobs() {
  const { jobs, addXP, user, isAuthenticated, isHydrating } = useGame();
  const [activeFilter, setActiveFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedJob, setSelectedJob] = useState<string | null>(null);
  const [savedJobs, setSavedJobs] = useState<Set<string>>(new Set());
  const [appliedJobs, setAppliedJobs] = useState<Set<string>>(new Set());

  const filteredJobs = jobs.filter(job => {
    const matchesSearch = job.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.company.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = activeFilter === 'All' ||
      (activeFilter === 'Remote' && job.location.toLowerCase().includes('remote')) ||
      (activeFilter === 'Full-time' && job.type === 'Full-time') ||
      (activeFilter === 'High Match' && job.matchPercent >= 85) ||
      (activeFilter === 'Top Companies' && ['Stripe', 'Vercel', 'Figma', 'Linear', 'Notion'].includes(job.company));
    return matchesSearch && matchesFilter;
  });

  const selectedJobData = jobs.find(j => j.id === selectedJob);

  const matchColor = (pct: number) => pct >= 90 ? '#10b981' : pct >= 80 ? '#06b6d4' : pct >= 70 ? '#f59e0b' : '#f43f5e';

  useEffect(() => {
    if (!isAuthenticated) return;

    void (async () => {
      try {
        const [savedRes, appsRes] = await Promise.all([
          fetch('/api/v1/jobs/saved', { credentials: 'include' }),
          fetch('/api/v1/jobs/applications', { credentials: 'include' }),
        ]);
        const [savedJson, appsJson] = await Promise.all([savedRes.json().catch(() => ({})), appsRes.json().catch(() => ({}))]);

        const savedIds = new Set<string>(Array.isArray(savedJson?.data) ? savedJson.data.map((x: any) => String(x.jobId)) : []);
        const appliedIds = new Set<string>(
          Array.isArray(appsJson?.data) ? appsJson.data.map((x: any) => String(x.jobId)) : [],
        );

        setSavedJobs(savedIds);
        setAppliedJobs(appliedIds);
      } catch {
        // non-fatal
      }
    })();
  }, [isAuthenticated]);

  const handleSave = async (jobId: string) => {
    try {
      const res = await fetch('/api/v1/jobs/saved', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId }),
        credentials: 'include',
      });
      if (!res.ok) return;
      setSavedJobs(prev => new Set([...prev, jobId]));
    } catch {
      // non-fatal
    }
  };

  const handleApply = async (jobId: string) => {
    const job = jobs.find(j => j.id === jobId);
    try {
      const res = await fetch('/api/v1/jobs/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId, status: 'APPLIED' }),
        credentials: 'include',
      });
      if (!res.ok) return;

      setAppliedJobs(prev => new Set([...prev, jobId]));
      addXP(job?.xpReward || 100);
      setSelectedJob(null);

      if (job?.url) {
        window.open(job.url, '_blank', 'noopener,noreferrer');
      }
    } catch {
      // non-fatal
    }
  };

  return (
    <div className="app-page" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
      {/* Header */}
      <div className="section-pad pt-5 pb-3">
        <div className="flex items-center justify-between mb-1">
          <h1 style={{ color: 'var(--cp-text-primary)', fontWeight: 700, fontSize: '1.3rem' }}>Job Matches</h1>
          <div className="flex items-center gap-1.5 rounded-xl px-3 py-1.5"
            style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)' }}>
            <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            <span style={{ color: '#10b981', fontSize: '0.78rem', fontWeight: 600 }}>{jobs.length} matches</span>
          </div>
        </div>
        <p style={{ color: 'var(--cp-text-muted)', fontSize: '0.85rem' }}>AI-curated for {user.targetRole}</p>
      </div>

      {/* AI Match summary */}
      <div className="section-pad mb-4">
        <div className="glass-card-purple rounded-2xl p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(124,58,237,0.2)' }}>
            <TrendingUp size={20} color="#a78bfa" />
          </div>
          <div className="flex-1">
            <div style={{ color: 'var(--cp-text-primary)', fontWeight: 600, fontSize: '0.9rem' }}>87% Avg Match Rate</div>
            <div style={{ color: 'var(--cp-text-muted)', fontSize: '0.75rem' }}>Top 15% candidate in your field</div>
          </div>
          <div style={{ color: '#a78bfa', fontSize: '0.8rem', fontWeight: 600 }}>Elite ✦</div>
        </div>
      </div>

      {/* Search */}
      <div className="section-pad mb-3">
        <div className="flex items-center gap-3 rounded-2xl px-4 py-3"
          style={{ background: 'var(--cp-bg-card)', border: '1px solid var(--cp-border)' }}>
          <Search size={16} color="#475569" />
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search roles, companies..."
            className="flex-1 outline-none bg-transparent"
            style={{ color: 'var(--cp-text-primary)', fontSize: '0.9rem' }}
          />
        </div>
      </div>

      {/* Filters */}
      <div className="section-pad mb-4 overflow-x-auto">
        <div className="flex gap-2 pb-1">
          {filters.map(f => (
            <button
              key={f}
              type="button"
              onClick={() => setActiveFilter(f)}
              className="shrink-0 rounded-xl px-4 py-2 text-sm transition-all"
              style={{
                background: activeFilter === f ? 'rgba(124,58,237,0.25)' : 'rgba(255,255,255,0.05)',
                border: activeFilter === f ? '1px solid rgba(124,58,237,0.4)' : '1px solid rgba(255,255,255,0.08)',
                color: activeFilter === f ? '#a78bfa' : '#64748b',
                fontWeight: activeFilter === f ? 600 : 400,
              }}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Job Cards */}
      <div className="section-pad mb-6 space-y-4">
        {isHydrating && filteredJobs.length === 0 && (
          <div className="animate-pulse space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="rounded-3xl h-28" style={{ background: 'var(--cp-bg-card)' }} />
            ))}
          </div>
        )}
        {!isHydrating && filteredJobs.length === 0 && (
          <div
            className="rounded-3xl p-8 text-center glass-card"
            style={{ border: '1px dashed rgba(255,255,255,0.12)' }}
          >
            <p style={{ fontSize: '2rem', marginBottom: '8px' }}>💼</p>
            <p style={{ color: 'var(--cp-text-muted)', fontSize: '0.9rem', marginBottom: '12px' }}>
              {searchQuery || activeFilter !== 'All'
                ? 'No roles match your search or filters.'
                : 'No job matches yet — complete your profile to get AI-curated jobs.'}
            </p>
            {(searchQuery || activeFilter !== 'All') && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setActiveFilter('All');
                }}
                className="rounded-xl px-4 py-2 text-sm font-semibold"
                style={{ background: 'rgba(124,58,237,0.2)', border: '1px solid rgba(124,58,237,0.35)', color: '#a78bfa' }}
              >
                Reset search & filters
              </button>
            )}
          </div>
        )}
        {filteredJobs.map((job, i) => (
          <motion.button
            key={job.id}
            type="button"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.07 }}
            onClick={() => setSelectedJob(job.id)}
            className="w-full text-left rounded-3xl overflow-hidden"
            style={{
              background: appliedJobs.has(job.id) ? 'rgba(16,185,129,0.06)' : 'rgba(255,255,255,0.04)',
              border: appliedJobs.has(job.id) ? '1px solid rgba(16,185,129,0.2)' : '1px solid rgba(255,255,255,0.08)',
            }}
            whileTap={{ scale: 0.98 }}
          >
            <div className="p-4">
              <div className="flex items-start gap-3 mb-3">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-xl shrink-0 glass-card">
                  {job.logo}
                </div>
                <div className="flex-1 min-w-0">
                  <div style={{ color: 'var(--cp-text-primary)', fontWeight: 700, fontSize: '0.95rem' }}>{job.title}</div>
                  <div style={{ color: 'var(--cp-text-muted)', fontSize: '0.82rem' }}>{job.company}</div>
                  <div className="flex items-center gap-3 mt-1">
                    <div className="flex items-center gap-1">
                      <MapPin size={11} color="#475569" />
                      <span style={{ color: 'var(--cp-text-muted)', fontSize: '0.72rem' }}>{job.location}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock size={11} color="#475569" />
                      <span style={{ color: 'var(--cp-text-muted)', fontSize: '0.72rem' }}>{job.postedDays}d ago</span>
                    </div>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div style={{ color: matchColor(job.matchPercent), fontWeight: 800, fontSize: '1.2rem' }}>
                    {job.matchPercent}%
                  </div>
                  <div style={{ color: 'var(--cp-text-muted)', fontSize: '0.65rem' }}>match</div>
                </div>
              </div>

              {/* Match bar */}
              <div className="mb-3">
                <div className="rounded-full overflow-hidden" style={{ background: 'var(--cp-bg-elevated)', height: '4px' }}>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${job.matchPercent}%` }}
                    transition={{ duration: 1, delay: i * 0.1 }}
                    style={{ height: '100%', borderRadius: '999px', background: matchColor(job.matchPercent), boxShadow: `0 0 6px ${matchColor(job.matchPercent)}60` }}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <div style={{ color: '#10b981', fontWeight: 600, fontSize: '0.82rem' }}>{job.salary}</div>
                  {job.missingSkills.length > 0 ? (
                    <div className="flex items-center gap-1.5 mt-1">
                      <AlertCircle size={11} color="#f59e0b" />
                      <span style={{ color: 'var(--cp-text-muted)', fontSize: '0.7rem' }}>Missing: {job.missingSkills.slice(0, 2).join(', ')}</span>
                    </div>
                  ) : (
                    <div style={{ color: '#10b981', fontSize: '0.7rem', marginTop: '2px' }}>✓ All skills match!</div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {appliedJobs.has(job.id) ? (
                    <div className="rounded-xl px-3 py-1.5" style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)' }}>
                      <span style={{ color: '#10b981', fontSize: '0.75rem', fontWeight: 600 }}>Applied ✓</span>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-1">
                        <Zap size={12} color="#f59e0b" />
                        <span style={{ color: '#f59e0b', fontSize: '0.72rem', fontWeight: 600 }}>+{job.xpReward}</span>
                      </div>
                      <ChevronRight size={16} color="#475569" />
                    </>
                  )}
                </div>
              </div>
            </div>
          </motion.button>
        ))}
      </div>

      <CareerDialog
        open={Boolean(selectedJob && selectedJobData)}
        onOpenChange={open => {
          if (!open) setSelectedJob(null);
        }}
        size="xl"
        contentClassName=""
      >
        {selectedJobData && (
          <div className="pr-8">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl glass-card">
                {selectedJobData.logo}
              </div>
              <div>
                <div style={{ color: 'var(--cp-text-primary)', fontWeight: 700 }}>{selectedJobData.company}</div>
                <div style={{ color: 'var(--cp-text-muted)', fontSize: '0.78rem' }}>{selectedJobData.location}</div>
              </div>
            </div>

            <h2 style={{ color: 'var(--cp-text-primary)', fontWeight: 800, fontSize: '1.3rem', marginBottom: '16px' }}>
              {selectedJobData.title}
            </h2>

            <div className="rounded-2xl p-4 mb-5 text-center"
              style={{ background: `${matchColor(selectedJobData.matchPercent)}12`, border: `1px solid ${matchColor(selectedJobData.matchPercent)}30` }}>
              <div style={{ color: matchColor(selectedJobData.matchPercent), fontWeight: 800, fontSize: '2rem' }}>
                {selectedJobData.matchPercent}%
              </div>
              <div style={{ color: 'var(--cp-text-muted)', fontSize: '0.82rem' }}>AI Match Score</div>
            </div>

            <div className="space-y-3 mb-5">
              {[
                { label: 'Salary', value: selectedJobData.salary, color: '#10b981' },
                { label: 'Type', value: selectedJobData.type, color: '#06b6d4' },
                { label: 'Posted', value: `${selectedJobData.postedDays} days ago`, color: 'var(--cp-text-muted)' },
                { label: 'XP Reward', value: `+${selectedJobData.xpReward} XP on apply`, color: '#f59e0b' },
              ].map(d => (
                <div key={d.label} className="flex items-center justify-between">
                  <span style={{ color: 'var(--cp-text-muted)', fontSize: '0.85rem' }}>{d.label}</span>
                  <span style={{ color: d.color, fontWeight: 600, fontSize: '0.85rem' }}>{d.value}</span>
                </div>
              ))}
            </div>

            {selectedJobData.missingSkills.length > 0 && (
              <div className="rounded-2xl p-4 mb-5" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle size={16} color="#f59e0b" />
                  <span style={{ color: '#f59e0b', fontWeight: 600, fontSize: '0.85rem' }}>Skills to develop</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {selectedJobData.missingSkills.map(skill => (
                    <div key={skill} className="rounded-xl px-3 py-1.5"
                      style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)', color: '#f59e0b', fontSize: '0.8rem' }}>
                      {skill}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <motion.button
                type="button"
                whileTap={{ scale: 0.97 }}
                onClick={() => void handleSave(selectedJobData.id)}
                className="flex-1 py-4 rounded-2xl flex items-center justify-center gap-3"
                style={{
                  background: savedJobs.has(selectedJobData.id) ? 'rgba(16,185,129,0.12)' : 'rgba(255,255,255,0.04)',
                  border: '1px solid var(--cp-border)',
                  color: savedJobs.has(selectedJobData.id) ? '#10b981' : '#94a3b8',
                  fontWeight: 700,
                  fontSize: '1rem',
                }}
              >
                <Briefcase size={18} />
                {savedJobs.has(selectedJobData.id) ? 'Saved ✓' : 'Save job'}
              </motion.button>

              <motion.button
                type="button"
                whileTap={{ scale: 0.97 }}
                onClick={() => void handleApply(selectedJobData.id)}
                className="flex-1 py-4 rounded-2xl flex items-center justify-center gap-3"
                style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)', border: 'none', color: 'white', fontWeight: 700, fontSize: '1rem' }}
              >
                <Briefcase size={20} />
                Apply Now
                <div className="flex items-center gap-1 rounded-xl px-2 py-1" style={{ background: 'rgba(245,158,11,0.3)' }}>
                  <Zap size={12} color="#f59e0b" />
                  <span style={{ color: '#fbbf24', fontSize: '0.78rem', fontWeight: 700 }}>+{selectedJobData.xpReward} XP</span>
                </div>
              </motion.button>
            </div>
          </div>
        )}
      </CareerDialog>
    </div>
  );
}
