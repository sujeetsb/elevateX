'use client';

import { useEffect, useState, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { motion } from 'motion/react';
import { Search, MapPin, Clock, Zap, ChevronRight, Briefcase, TrendingUp, AlertCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useGame } from '../components/GameContext';
import { CareerDialog } from '../components/CareerDialog';
import { DialogTitle } from '@/components/ui/dialog';
import { ProUpgradeModal } from '../components/ProUpgradeModal';
import { coverLetterPdfDataUrl, downloadCoverLetterPdf } from '@/lib/pdf/cover-letter-pdf';
import { resumePdfDataUrl, downloadResumePdf } from '@/lib/pdf/resume-pdf';
import { interviewPrepPdfDataUrl, downloadInterviewPrepPdf } from '@/lib/pdf/interview-prep-pdf';
import { isProTierClient } from '@/lib/subscription/tier';
import { getXpCost } from '@/lib/gamification/xp-costs';
import { LowXpAlert } from '@/components/LowXpAlert';
import { useProfileInsights } from '@/lib/hooks/use-profile-insights';
import {
  useCoverLetter,
  useGenerateCoverLetterMutation,
  useGenerateInterviewPrepMutation,
  useInterviewPrep,
  useOptimizeResumeMutation,
  useOptimizedResume,
} from '@/lib/hooks/use-job-documents';

const filters = ['All', 'Remote', 'Full-time', 'High Match', 'Top Companies'];

export function Jobs() {
  const { data: session } = useSession();
  const userId = session?.user?.id;
  const { jobs, addXP, user, isAuthenticated, isHydrating, refresh, jobsLoading, jobsError } = useGame();
  const { data: profileInsights } = useProfileInsights(user.profileVersion, isAuthenticated);
  const isPro = isProTierClient(user.subscriptionTier);
  const [activeFilter, setActiveFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedJob, setSelectedJob] = useState<string | null>(null);
  const [savedJobs, setSavedJobs] = useState<Set<string>>(new Set());
  const [appliedJobs, setAppliedJobs] = useState<Set<string>>(new Set());
  const [applyLoading, setApplyLoading] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [showProModal, setShowProModal] = useState(false);
  const [proFeature, setProFeature] = useState('Job applications');
  const [showCoverPdf, setShowCoverPdf] = useState(false);
  const [coverPdfUrl, setCoverPdfUrl] = useState('');
  const [showResumePdf, setShowResumePdf] = useState(false);
  const [resumePdfUrl, setResumePdfUrl] = useState('');
  const [showInterviewPdf, setShowInterviewPdf] = useState(false);
  const [interviewPdfUrl, setInterviewPdfUrl] = useState('');
  const [interviewXpError, setInterviewXpError] = useState<{ required?: number; balance?: number; suggestions?: string[] } | null>(null);
  const [loadSavedResume, setLoadSavedResume] = useState(false);

  const selectedJobData = jobs.find(j => j.id === selectedJob);

  const displayMissingSkills = useMemo(() => {
    if (!selectedJobData) return [];
    const fromJob = selectedJobData.missingSkills ?? [];
    if (fromJob.length >= 2) return fromJob;
    const insightSkills = (profileInsights?.skillsGap ?? [])
      .map(g => g.skill)
      .filter(s => !user.skills.some(us => us.toLowerCase() === s.toLowerCase()));
    return Array.from(new Set([...fromJob, ...insightSkills])).slice(0, 4);
  }, [selectedJobData, profileInsights?.skillsGap, user.skills]);
  const { data: savedOptimizedResume, isFetching: loadingSavedResume } = useOptimizedResume(
    userId,
    loadSavedResume ? selectedJob : null,
  );
  const { data: coverLetterDoc } = useCoverLetter(userId, selectedJob);
  const { data: interviewPrepDoc } = useInterviewPrep(userId, selectedJob);
  const optimizeMutation = useOptimizeResumeMutation(userId);
  const coverLetterMutation = useGenerateCoverLetterMutation(userId);
  const interviewPrepMutation = useGenerateInterviewPrepMutation(userId);

  useEffect(() => {
    setLoadSavedResume(false);
    optimizeMutation.reset();
  }, [selectedJob]); // eslint-disable-line react-hooks/exhaustive-deps

  const coverLetter = coverLetterDoc?.letter ?? null;
  const optimizeResult = optimizeMutation.data ?? (loadSavedResume ? savedOptimizedResume ?? null : null);
  const optimizeLoading = optimizeMutation.isPending;
  const optimizeError = optimizeMutation.error instanceof Error ? optimizeMutation.error.message : null;
  const coverLetterLoading = coverLetterMutation.isPending;
  const coverLetterError = coverLetterMutation.error instanceof Error ? coverLetterMutation.error.message : null;
  const interviewPrep = interviewPrepDoc ?? null;
  const interviewPrepLoading = interviewPrepMutation.isPending;
  const interviewPrepError = interviewPrepMutation.error instanceof Error ? interviewPrepMutation.error.message : null;

  const buildCoverPdfInput = () => {
    if (!coverLetter) return null;
    return coverLetter;
  };

  const openCoverPdfPreview = () => {
    const input = buildCoverPdfInput();
    if (!input) return;
    setCoverPdfUrl(coverLetterPdfDataUrl(input));
    setShowCoverPdf(true);
  };

  const handleDownloadCoverPdf = () => {
    const input = buildCoverPdfInput();
    if (!input) return;
    downloadCoverLetterPdf(input);
    toast.success('Cover letter PDF downloaded');
  };

  const openResumePdfPreview = () => {
    if (!optimizeResult?.document) return;
    setResumePdfUrl(resumePdfDataUrl(optimizeResult.document, optimizeResult.template));
    setShowResumePdf(true);
  };

  const handleDownloadResumePdf = () => {
    if (!optimizeResult?.document || !selectedJobData) return;
    downloadResumePdf(
      optimizeResult.document,
      optimizeResult.template,
      `resume-${selectedJobData.company}-${selectedJobData.title}.pdf`.replace(/[^a-z0-9.-]+/gi, '-').toLowerCase(),
    );
    toast.success('Resume PDF downloaded');
  };

  const buildJobDescription = (job: typeof selectedJobData) => {
    if (!job) return '';
    const gaps = displayMissingSkills.length ? displayMissingSkills : job.missingSkills;
    return `${job.title} at ${job.company}. ${job.type}. Location: ${job.location}. Skills gap: ${gaps.join(', ') || 'none'}. Match ${job.matchPercent}%.`;
  };

  const handleGenerateInterviewPrep = async () => {
    if (!selectedJobData) return;
    if (!isPro) {
      setProFeature('Interview Preparation');
      setShowProModal(true);
      return;
    }
    setInterviewXpError(null);
    try {
      await interviewPrepMutation.mutateAsync({
        jobId: selectedJobData.id,
        jobTitle: selectedJobData.title,
        company: selectedJobData.company,
        jobDescription: buildJobDescription(selectedJobData),
      });
      void refresh();
      toast.success('Interview prep generated');
    } catch (e) {
      const err = e as Error & { status?: number; code?: string; details?: { required?: number; balance?: number; suggestions?: string[] } };
      if (err.status === 403) {
        setProFeature('Interview Preparation');
        setShowProModal(true);
        return;
      }
      if (err.code === 'INSUFFICIENT_XP' && err.details) {
        setInterviewXpError(err.details);
      }
      toast.error(err.message || 'Could not generate interview prep');
    }
  };

  const openInterviewPdfPreview = () => {
    if (!interviewPrep) return;
    setInterviewPdfUrl(interviewPrepPdfDataUrl(interviewPrep));
    setShowInterviewPdf(true);
  };

  const handleDownloadInterviewPdf = () => {
    if (!interviewPrep) return;
    downloadInterviewPrepPdf(interviewPrep);
    toast.success('Interview prep PDF downloaded');
  };

  const filteredJobs = jobs.filter(job => {
    const matchesSearch = job.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.company.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = activeFilter === 'All' ||
      (activeFilter === 'Remote' && job.location.toLowerCase().includes('remote')) ||
      (activeFilter === 'Full-time' && job.type === 'Full-time') ||
      (activeFilter === 'High Match' && job.matchPercent >= 75) ||
      (activeFilter === 'Top Companies' && ['Stripe', 'Vercel', 'Figma', 'Linear', 'Notion'].includes(job.company));
    return matchesSearch && matchesFilter;
  });

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
      if (savedJobs.has(jobId)) {
        const res = await fetch(`/api/v1/jobs/saved?jobId=${encodeURIComponent(jobId)}`, {
          method: 'DELETE',
          credentials: 'include',
        });
        if (!res.ok) return;
        setSavedJobs(prev => {
          const next = new Set(prev);
          next.delete(jobId);
          return next;
        });
        toast.success('Removed from saved');
        return;
      }
      const res = await fetch('/api/v1/jobs/saved', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId }),
        credentials: 'include',
      });
      if (!res.ok) return;
      setSavedJobs(prev => new Set([...prev, jobId]));
      toast.success('Job saved');
    } catch {
      // non-fatal
    }
  };

  const handleOptimizeResume = async () => {
    if (!selectedJobData) return;
    if (!isPro) {
      setProFeature('Job-tailored resume optimization');
      setShowProModal(true);
      return;
    }
    const jobDescription = buildJobDescription(selectedJobData);
    try {
      await optimizeMutation.mutateAsync({
        jobId: selectedJobData.id,
        jobTitle: selectedJobData.title,
        company: selectedJobData.company,
        jobDescription,
      });
      setLoadSavedResume(true);
      toast.success('Resume optimized for this role');
    } catch (e) {
      const err = e as Error & { status?: number };
      if (err.status === 403) {
        setProFeature('Job-tailored resume optimization');
        setShowProModal(true);
        return;
      }
    }
  };

  const handleGenerateCoverLetter = async () => {
    if (!selectedJobData) return;
    if (!isPro) {
      setProFeature('Cover letter generation');
      setShowProModal(true);
      return;
    }
    try {
      await coverLetterMutation.mutateAsync({
        jobId: selectedJobData.id,
        jobTitle: selectedJobData.title,
        company: selectedJobData.company,
        jobDescription: `${selectedJobData.title} at ${selectedJobData.company}. ${selectedJobData.type} role. Skills: ${selectedJobData.missingSkills.join(', ') || 'general fit'}.`,
      });
      toast.success('Cover letter generated');
    } catch (e) {
      const err = e as Error & { status?: number };
      if (err.status === 403) {
        setProFeature('Cover letter generation');
        setShowProModal(true);
      }
    }
  };

  const handleApply = async (jobId: string) => {
    if (!isPro) {
      setProFeature('Job applications');
      setShowProModal(true);
      return;
    }
    const job = jobs.find(j => j.id === jobId);
    setApplyLoading(true);
    setApplyError(null);
    try {
      const res = await fetch('/api/v1/jobs/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId, status: 'APPLIED' }),
        credentials: 'include',
      });
      const json = await res.json().catch(() => ({}));

      if (res.status === 403) {
        setProFeature('Job applications');
        setShowProModal(true);
        return;
      }
      if (!res.ok) {
        throw new Error(json?.message ?? 'Could not submit application');
      }

      setAppliedJobs(prev => new Set([...prev, jobId]));
      addXP(job?.xpReward || 100);
      toast.success('Application submitted!', {
        description: job ? `${job.title} at ${job.company}` : undefined,
      });
      setSelectedJob(null);

      if (job?.url) {
        window.open(job.url, '_blank', 'noopener,noreferrer');
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Application failed';
      setApplyError(msg);
      toast.error('Application failed', { description: msg });
    } finally {
      setApplyLoading(false);
    }
  };

  if (isHydrating) {
    return (
      <div className="app-page section-pad pt-6">
        <div className="animate-pulse space-y-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="rounded-3xl h-28" style={{ background: 'var(--cp-bg-card)' }} />
          ))}
        </div>
      </div>
    );
  }

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
        {jobsError && !jobs.length && (
          <div className="rounded-3xl p-5 glass-card" style={{ border: '1px solid rgba(244,63,94,0.3)' }}>
            <p style={{ color: '#fda4af', fontSize: '0.85rem', marginBottom: '10px' }}>{jobsError}</p>
            <button
              type="button"
              onClick={() => void refresh()}
              className="rounded-xl px-4 py-2 text-sm font-semibold"
              style={{ background: 'rgba(124,58,237,0.2)', border: '1px solid rgba(124,58,237,0.35)', color: '#a78bfa' }}
            >
              Retry
            </button>
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
                : jobsLoading
                  ? 'Refreshing your latest job matches...'
                  : 'No job matches yet. We will keep suggestions updated as your profile improves.'}
            </p>
            {(searchQuery || activeFilter !== 'All') ? (
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
            ) : (
              <button
                type="button"
                onClick={() => void refresh()}
                className="rounded-xl px-4 py-2 text-sm font-semibold"
                style={{ background: 'rgba(124,58,237,0.2)', border: '1px solid rgba(124,58,237,0.35)', color: '#a78bfa' }}
              >
                Retry job matching
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

      <ProUpgradeModal open={showProModal} onOpenChange={setShowProModal} feature={proFeature} />

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

            {displayMissingSkills.length > 0 && (
              <div className="rounded-2xl p-4 mb-5" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle size={16} color="#f59e0b" />
                  <span style={{ color: '#f59e0b', fontWeight: 600, fontSize: '0.85rem' }}>Skills to develop</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {displayMissingSkills.map(skill => (
                    <div key={skill} className="rounded-xl px-3 py-1.5"
                      style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)', color: '#f59e0b', fontSize: '0.8rem' }}>
                      {skill}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mb-5">
              {optimizeResult ? <div className="rounded-xl p-2 mb-2" style={{ border: '1px solid var(--cp-border)' }}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs" style={{ color: '#10b981', fontWeight: 600 }}>Optimized Resume</span>
                  {optimizeResult?.atsScoreAfter != null && (
                    <span className="text-xs" style={{ color: '#10b981' }}>
                      ATS {optimizeResult.atsScoreAfter}
                      {optimizeResult.resumeVersion > 1 ? ` · v${optimizeResult.resumeVersion}` : ''}
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={openResumePdfPreview}
                    disabled={!optimizeResult}
                    className="flex-1 py-2 rounded-xl text-xs font-semibold glass-card disabled:opacity-50"
                    style={{ color: '#10b981' }}
                  >
                    Preview
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadResumePdf}
                    disabled={!optimizeResult}
                    className="flex-1 py-2 rounded-xl text-xs font-semibold btn-primary disabled:opacity-50"
                  >
                    Download
                  </button>
                </div>
              </div> : <div>
                <button
                  type="button"
                  onClick={() => void handleOptimizeResume()}
                  disabled={optimizeLoading}
                  className="w-full py-3 rounded-2xl text-sm font-semibold mb-2 disabled:opacity-60"
                  style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.35)', color: '#10b981' }}
                >
                  {optimizeLoading ? 'Optimizing resume…' : isPro ? '🎯 Optimize Resume for This Job' : '🎯 Optimize Resume for This Job (PRO)'}
                </button>
                {!loadSavedResume && !optimizeLoading && (
                  <button
                    type="button"
                    onClick={() => setLoadSavedResume(true)}
                    className="w-full py-2 rounded-xl text-xs font-medium mb-2"
                    style={{ color: 'var(--cp-text-muted)', background: 'var(--cp-surface-1)', border: '1px solid var(--cp-border-subtle)' }}
                  >
                    Load previously saved optimization
                  </button>
                )}
                {loadingSavedResume && (
                  <p className="text-xs mb-2" style={{ color: 'var(--cp-text-muted)' }}>Checking for saved resume…</p>
                )}

                {optimizeError && <p className="text-xs text-rose-400 mb-2">{optimizeError}</p>}
              </div>}
              {
                coverLetter ? <div className="rounded-xl p-2" style={{ border: '1px solid var(--cp-border)' }}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs" style={{ color: '#a78bfa', fontWeight: 600 }}>Cover Letter</span>
                    <span className="text-xs" style={{ color: 'var(--cp-text-muted)' }}>
                      {coverLetter ? 'Generated' : 'Not generated'}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={openCoverPdfPreview}
                      disabled={!coverLetter}
                      className="flex-1 py-2 rounded-xl text-xs font-semibold glass-card disabled:opacity-50"
                      style={{ color: '#a78bfa' }}
                    >
                      Preview
                    </button>
                    <button
                      type="button"
                      onClick={handleDownloadCoverPdf}
                      disabled={!coverLetter}
                      className="flex-1 py-2 rounded-xl text-xs font-semibold btn-primary disabled:opacity-50"
                    >
                      Download
                    </button>
                  </div>
                </div> : <div>
                  <button
                    type="button"
                    onClick={() => void handleGenerateCoverLetter()}
                    disabled={coverLetterLoading}
                    className="w-full py-3 rounded-2xl text-sm font-semibold mb-2 disabled:opacity-60"
                    style={{ background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.35)', color: '#a78bfa' }}
                  >
                    {coverLetterLoading ? 'Generating cover letter…' : isPro ? '✨ Generate Cover Letter' : '✨ Generate Cover Letter (PRO)'}
                  </button>
                  {coverLetterError && <p className="text-xs text-rose-400 mb-2">{coverLetterError}</p>}
                </div>
              }

              {interviewPrep ? (
                <div className="rounded-xl p-2 mt-3" style={{ border: '1px solid var(--cp-border)' }}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs" style={{ color: '#06b6d4', fontWeight: 600 }}>Interview Preparation</span>
                    <span className="text-xs" style={{ color: 'var(--cp-text-muted)' }}>Saved</span>
                  </div>
                  <div className="text-xs mb-2 space-y-1" style={{ color: 'var(--cp-text-muted)' }}>
                    <div>{interviewPrep.behavioralQuestions.length} behavioral · {interviewPrep.technicalQuestions.length} technical</div>
                    <div>{interviewPrep.hrQuestions.length} HR · {interviewPrep.scenarioQuestions.length} scenario</div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={openInterviewPdfPreview}
                      className="flex-1 py-2 rounded-xl text-xs font-semibold glass-card"
                      style={{ color: '#06b6d4' }}
                    >
                      Preview
                    </button>
                    <button
                      type="button"
                      onClick={handleDownloadInterviewPdf}
                      className="flex-1 py-2 rounded-xl text-xs font-semibold btn-primary"
                    >
                      Download PDF
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-3">
                  <button
                    type="button"
                    onClick={() => void handleGenerateInterviewPrep()}
                    disabled={interviewPrepLoading}
                    className="w-full py-3 rounded-2xl text-sm font-semibold mb-2 disabled:opacity-60"
                    style={{ background: 'rgba(6,182,212,0.12)', border: '1px solid rgba(6,182,212,0.35)', color: '#06b6d4' }}
                  >
                    {interviewPrepLoading
                      ? 'Generating interview prep…'
                      : isPro
                        ? `🎯 Interview Preparation (−${getXpCost('INTERVIEW_PREP')} XP)`
                        : '🎯 Interview Preparation (PRO)'}
                  </button>
                  {interviewPrepError && <p className="text-xs text-rose-400 mb-2">{interviewPrepError}</p>}
                  {interviewXpError && <LowXpAlert {...interviewXpError} className="mb-2" />}
                </div>
              )}
            </div>

            {applyError && (
              <p className="text-xs text-rose-400 mb-3" role="alert">{applyError}</p>
            )}

            <div className="flex gap-3">
              <motion.button
                type="button"
                whileTap={{ scale: 0.97 }}
                onClick={() => void handleSave(selectedJobData.id)}
                disabled={applyLoading}
                className="flex-1 py-4 rounded-2xl flex items-center justify-center gap-3 disabled:opacity-60"
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

              {appliedJobs.has(selectedJobData.id) ? (
                <div
                  className="flex-1 py-4 rounded-2xl flex items-center justify-center gap-2"
                  style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)', color: '#10b981', fontWeight: 700 }}
                >
                  Applied ✓
                </div>
              ) : (
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.97 }}
                  disabled={applyLoading}
                  onClick={() => void handleApply(selectedJobData.id)}
                  className="flex-1 py-4 rounded-2xl flex items-center justify-center gap-3 disabled:opacity-70"
                  style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)', border: 'none', color: 'white', fontWeight: 700, fontSize: '1rem' }}
                >
                  {applyLoading ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      Applying…
                    </>
                  ) : (
                    <>
                      <Briefcase size={20} />
                      Apply Now
                      <div className="flex items-center gap-1 rounded-xl px-2 py-1" style={{ background: 'rgba(245,158,11,0.3)' }}>
                        <Zap size={12} color="#f59e0b" />
                        <span style={{ color: '#fbbf24', fontSize: '0.78rem', fontWeight: 700 }}>+{selectedJobData.xpReward} XP</span>
                      </div>
                    </>
                  )}
                </motion.button>
              )}
            </div>
          </div>
        )}
      </CareerDialog>

      <CareerDialog open={showResumePdf} onOpenChange={setShowResumePdf}>
        <DialogTitle className="sr-only">Resume PDF preview</DialogTitle>
        <div className="pr-8">
          <h3 style={{ color: 'var(--cp-text-primary)', fontWeight: 700, marginBottom: '12px' }}>Optimized resume preview</h3>
          {resumePdfUrl ? (
            <iframe
              title="Resume PDF preview"
              src={resumePdfUrl}
              className="w-full rounded-xl border"
              style={{ height: '420px', borderColor: 'var(--cp-border)' }}
            />
          ) : null}
          <button
            type="button"
            onClick={handleDownloadResumePdf}
            className="btn-primary w-full py-2.5 rounded-xl mt-4 text-sm font-semibold"
          >
            Download PDF
          </button>
        </div>
      </CareerDialog>

      <CareerDialog open={showCoverPdf} onOpenChange={setShowCoverPdf}>
        <DialogTitle className="sr-only">Cover letter PDF preview</DialogTitle>
        <div className="pr-8">
          <h3 style={{ color: 'var(--cp-text-primary)', fontWeight: 700, marginBottom: '12px' }}>Cover letter preview</h3>
          {coverPdfUrl ? (
            <iframe
              title="Cover letter PDF preview"
              src={coverPdfUrl}
              className="w-full rounded-xl border"
              style={{ height: '420px', borderColor: 'var(--cp-border)' }}
            />
          ) : null}
          <button
            type="button"
            onClick={handleDownloadCoverPdf}
            className="btn-primary w-full py-2.5 rounded-xl mt-4 text-sm font-semibold"
          >
            Download PDF
          </button>
        </div>
      </CareerDialog>

      <CareerDialog open={showInterviewPdf} onOpenChange={setShowInterviewPdf}>
        <DialogTitle className="sr-only">Interview prep PDF preview</DialogTitle>
        <div className="pr-8">
          <h3 style={{ color: 'var(--cp-text-primary)', fontWeight: 700, marginBottom: '12px' }}>Interview preparation preview</h3>
          {interviewPdfUrl ? (
            <iframe
              title="Interview prep PDF preview"
              src={interviewPdfUrl}
              className="w-full rounded-xl border"
              style={{ height: '420px', borderColor: 'var(--cp-border)' }}
            />
          ) : null}
          <button
            type="button"
            onClick={handleDownloadInterviewPdf}
            className="btn-primary w-full py-2.5 rounded-xl mt-4 text-sm font-semibold"
          >
            Download PDF
          </button>
        </div>
      </CareerDialog>
    </div>
  );
}
