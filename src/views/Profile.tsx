'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useRouter } from 'next/navigation';
import { Edit3, Plus, ExternalLink, ChevronRight, Zap, TrendingUp, BarChart2, Shield, Trash2, Award } from 'lucide-react';
import { useGame } from '../components/GameContext';
import type { UserCertification } from '../components/GameContext';
import { ProfileMenuDropdown } from '../components/ProfileMenu';
import {
  PROFILE_TABS,
  ProfileCoursesTab,
  ProfileCertificatesTab,
  ProfileSavedJobsTab,
  ProfileAppliedJobsTab,
  ProfileResumesTab,
} from '../components/profile/ProfileExtraTabs';
import { RecommendedSkillsPanel } from '../components/profile/RecommendedSkillsPanel';
import { SubscriptionUpgradeModal } from '../components/SubscriptionUpgradeModal';
import { isProTierClient } from '@/lib/subscription/tier';
import { getAtsMessage } from '@/lib/ats/messaging';
import { formatAtsScore, hasAtsScore } from '@/lib/ats/display';

function ProfileRingSmall({ completion, color = '#7c3aed' }: { completion: number; color?: string }) {
  const r = 28;
  const circ = 2 * Math.PI * r;
  const dash = (completion / 100) * circ;
  return (
    <svg width="68" height="68" viewBox="0 0 68 68" style={{ transform: 'rotate(-90deg)' }}>
      <circle cx="34" cy="34" r={r} fill="none" stroke="var(--cp-border)" strokeWidth="6" />
      <motion.circle
        cx="34" cy="34" r={r} fill="none" stroke={color} strokeWidth="6"
        strokeDasharray={circ}
        initial={{ strokeDashoffset: circ }}
        animate={{ strokeDashoffset: circ - dash }}
        transition={{ duration: 1.5, ease: 'easeOut' }}
        strokeLinecap="round"
      />
    </svg>
  );
}

export function Profile() {
  const router = useRouter();
  const { user, xp, level, levelName, streak, profileCompletion, atsScore, badges, courses, addXP, updateProfile, signOut, refresh, isHydrating } = useGame();
  const [activeTab, setActiveTab] = useState<(typeof PROFILE_TABS)[number]['id']>('overview');
  const [showSubscribe, setShowSubscribe] = useState(false);
  const [editingSkills, setEditingSkills] = useState(false);
  const [newSkill, setNewSkill] = useState('');
  const [editingLink, setEditingLink] = useState<'linkedIn' | 'github' | null>(null);
  const [linkDraft, setLinkDraft] = useState('');
  const [linkError, setLinkError] = useState('');
  const [editingSalary, setEditingSalary] = useState(false);
  const [salarySaving, setSalarySaving] = useState(false);
  const [salaryError, setSalaryError] = useState('');
  const [salaryDraft, setSalaryDraft] = useState({
    currentSalary: user.currentSalary,
    salaryCurrency: user.salaryCurrency || 'USD',
    salaryFrequency: user.salaryFrequency || 'Annual',
    compensationType: user.compensationType,
    country: user.country,
    locationPreference: user.locationPreference,
  });

  useEffect(() => {
    setSalaryDraft({
      currentSalary: user.currentSalary,
      salaryCurrency: user.salaryCurrency || 'USD',
      salaryFrequency: user.salaryFrequency || 'Annual',
      compensationType: user.compensationType,
      country: user.country,
      locationPreference: user.locationPreference,
    });
  }, [
    user.currentSalary,
    user.salaryCurrency,
    user.salaryFrequency,
    user.compensationType,
    user.country,
    user.locationPreference,
  ]);

  const [editingCareer, setEditingCareer] = useState(false);
  const [careerDraft, setCareerDraft] = useState({
    currentRole: user.currentRole,
    targetRole: user.targetRole,
    experience: user.experience,
    education: user.education,
    preferredIndustry: user.preferredIndustry,
    careerGoal: user.careerGoal,
    salaryGoal: user.salaryGoal,
    salaryGoalCurrency: user.salaryGoalCurrency || 'USD',
    salaryGoalFrequency: user.salaryGoalFrequency || 'Annual',
  });
  const [careerSaving, setCareerSaving] = useState(false);
  const [careerError, setCareerError] = useState('');

  // Certifications state
  const blankCert = { name: '', issuer: '', issueDate: '', expiryDate: '', credentialId: '', credentialUrl: '' };
  const [showAddCert, setShowAddCert] = useState(false);
  const [certDraft, setCertDraft] = useState({ ...blankCert });
  const [certSaving, setCertSaving] = useState(false);
  const [certError, setCertError] = useState('');
  const [editingCertId, setEditingCertId] = useState<string | null>(null);
  const [editCertDraft, setEditCertDraft] = useState<Partial<UserCertification & typeof blankCert>>({});
  const [deletingCertId, setDeletingCertId] = useState<string | null>(null);

  const atsMsg = getAtsMessage(atsScore);
  const completedCourses = courses.filter(c => c.progress === 100).length;
  const earnedBadges = badges.filter(b => b.earnedAt);
  const lockedBadges = badges.filter(b => !b.earnedAt);

  const profileSections = [
    { label: 'Resume Upload', done: user.resumeUploaded, xp: 30, icon: '📄', action: '/app/ats' },
    { label: 'LinkedIn Profile', done: !!user.linkedIn, xp: 20, icon: '🔗', action: null },
    { label: 'GitHub Profile', done: !!user.github, xp: 20, icon: '🐙', action: null },
    { label: 'Certifications', done: user.certifications.length > 0, xp: 15, icon: '🏆', action: null },
    { label: 'Experience Added', done: !!user.experience?.trim(), xp: 15, icon: '💼', action: null },
  ];

  const rarityColors = {
    common: '#94a3b8', rare: '#06b6d4', epic: '#7c3aed', legendary: '#f59e0b',
  };

  const rarityBg = {
    common: 'rgba(148,163,184,0.1)', rare: 'rgba(6,182,212,0.12)', epic: 'rgba(124,58,237,0.15)', legendary: 'rgba(245,158,11,0.15)',
  };

  const addSkill = () => {
    if (newSkill.trim() && !user.skills.includes(newSkill.trim())) {
      updateProfile({ skills: [...user.skills, newSkill.trim()] });
      addXP(10);
      setNewSkill('');
    }
  };

  const saveCert = async (isEdit = false) => {
    const draft = isEdit ? editCertDraft : certDraft;
    if (!draft.name?.trim() || !draft.issuer?.trim()) {
      setCertError('Name and issuer are required');
      return;
    }
    setCertSaving(true);
    setCertError('');
    try {
      const payload = {
        name: draft.name!.trim(),
        issuer: draft.issuer!.trim(),
        issueDate: draft.issueDate?.trim() || null,
        expiryDate: draft.expiryDate?.trim() || null,
        credentialId: draft.credentialId?.trim() || null,
        credentialUrl: draft.credentialUrl?.trim() || null,
      };
      const url = isEdit ? `/api/v1/certifications/${editingCertId}` : '/api/v1/certifications';
      const method = isEdit ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { message?: string })?.message || 'Failed to save');
      }
      // Refresh from server to get updated certifications in context
      await refresh();
      setCertDraft({ ...blankCert });
      setShowAddCert(false);
      setEditingCertId(null);
    } catch (err) {
      setCertError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setCertSaving(false);
    }
  };

  const deleteCert = async (id: string) => {
    setDeletingCertId(id);
    try {
      await fetch(`/api/v1/certifications/${id}`, { method: 'DELETE', credentials: 'include' });
      await refresh();
    } finally {
      setDeletingCertId(null);
    }
  };

  return (
    <div className="app-page" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
      {/* Header */}
      <div className="section-pad pt-5 pb-4 flex items-center justify-between">
        <h1 style={{ color: 'var(--cp-text-primary)', fontWeight: 700, fontSize: '1.3rem' }}>Profile</h1>
        <ProfileMenuDropdown
          onNavigate={path => router.push(path)}
          onSignOut={() => { void signOut(); }}
        />
      </div>

      {/* Profile hero */}
      <div className="section-pad mb-5">
        <div className="rounded-3xl p-5 relative overflow-hidden"
          style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.2), rgba(6,182,212,0.1))', border: '1px solid rgba(124,58,237,0.25)' }}>
          <div className="absolute inset-0 opacity-5"
            style={{ backgroundImage: 'radial-gradient(circle at 80% 20%, #a78bfa, transparent 60%)' }} />

          <div className="flex items-center gap-4 mb-5">
            {/* Avatar */}
            <div className="relative">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center glow-purple"
                style={{ background: 'linear-gradient(135deg, #7c3aed, #06b6d4)' }}>
                <span style={{ color: 'white', fontWeight: 800, fontSize: '1.5rem' }}>{user.name.charAt(0)}</span>
              </div>
              <button className="absolute -bottom-1 -right-1 w-6 h-6 rounded-lg flex items-center justify-center"
                style={{ background: '#7c3aed', border: '2px solid var(--cp-bg-base)' }}>
                <Edit3 size={11} color="white" />
              </button>
            </div>

            <div className="flex-1">
              <h2 style={{ color: 'var(--cp-text-primary)', fontWeight: 800, fontSize: '1.1rem' }}>{user.name}</h2>
              <p style={{ color: 'var(--cp-text-muted)', fontSize: '0.82rem' }}>{user.currentRole}</p>
              <div className="flex items-center gap-2 mt-1">
                <div className="level-badge rounded-lg px-2 py-0.5">
                  <span style={{ color: 'var(--cp-text-inverse)', fontWeight: 700, fontSize: '0.7rem' }}>LVL {level}</span>
                </div>
                <span style={{ color: '#a78bfa', fontSize: '0.78rem' }}>{levelName}</span>
              </div>
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-4 gap-2 pt-4" style={{ borderTop: '1px solid var(--cp-border)' }}>
            {[
              { label: 'XP', value: xp.toLocaleString(), color: '#f59e0b' },
              { label: 'Streak', value: `${streak}🔥`, color: '#f43f5e' },
              { label: 'Badges', value: `${earnedBadges.length}`, color: '#a78bfa' },
              { label: 'Courses', value: `${courses.length}`, color: '#06b6d4' },
            ].map(s => (
              <div key={s.label} className="text-center">
                <div style={{ color: s.color, fontWeight: 700, fontSize: '1rem' }}>{s.value}</div>
                <div style={{ color: 'var(--cp-text-faint)', fontSize: '0.65rem' }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick links */}
      <div className="section-pad mb-5">
        <div className="responsive-grid-3">
          {[
            { label: 'ATS Score', value: hasAtsScore(atsScore) ? formatAtsScore(atsScore) : 'Analyze', icon: '🎯', path: '/app/ats', color: atsMsg.band === 'excellent' ? '#10b981' : atsMsg.band === 'good' ? '#06b6d4' : '#f59e0b' },
            { label: 'Analytics', value: 'View', icon: '📊', path: '/app/analytics?from=profile', color: '#a78bfa' },
            { label: 'Elevate Mentor', value: 'Chat', icon: '🤖', path: '/app/mentor', color: '#06b6d4' },
          ].map(item => (
            <button
              key={item.label}
              onClick={() => router.push(item.path)}
              className="glass-card rounded-2xl p-3 flex flex-col items-center gap-2"
            >
              <div className="text-xl">{item.icon}</div>
              <div style={{ color: item.color, fontWeight: 700, fontSize: '0.9rem' }}>{item.value}</div>
              <div style={{ color: 'var(--cp-text-muted)', fontSize: '0.68rem' }}>{item.label}</div>
            </button>
          ))}
        </div>
      </div>

      {!hasAtsScore(atsScore) && !isHydrating && (
        <div className="section-pad mb-5">
          <div className="glass-card rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex-1">
              <p style={{ color: 'var(--cp-text-primary)', fontWeight: 600, fontSize: '0.9rem' }}>{atsMsg.headline}</p>
              <p style={{ color: 'var(--cp-text-muted)', fontSize: '0.78rem', marginTop: '4px' }}>{atsMsg.body}</p>
            </div>
            <button
              onClick={() => router.push('/app/ats')}
              className="px-4 py-2 rounded-xl font-semibold text-sm shrink-0"
              style={{ background: 'var(--cp-accent)', color: 'var(--cp-text-inverse)' }}
            >
              Analyze Resume
            </button>
          </div>
        </div>
      )}

      {/* Tab bar */}
      <div className="section-pad mb-4 overflow-x-auto">
        <div className="flex gap-1 min-w-max rounded-2xl p-1" style={{ background: 'var(--cp-bg-card)' }}>
          {PROFILE_TABS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              className="py-2.5 px-3 rounded-xl transition-all whitespace-nowrap"
              style={{
                background: activeTab === id ? 'rgba(124,58,237,0.25)' : 'transparent',
                color: activeTab === id ? '#a78bfa' : '#64748b',
                fontWeight: activeTab === id ? 600 : 400,
                fontSize: '0.78rem',
                border: activeTab === id ? '1px solid rgba(124,58,237,0.35)' : '1px solid transparent',
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {!isProTierClient(user.subscriptionTier) && (
        <div className="section-pad mb-2">
          <button type="button" onClick={() => setShowSubscribe(true)} className="text-sm font-semibold" style={{ color: '#a78bfa' }}>
            Subscribe to PRO →
          </button>
        </div>
      )}
      <SubscriptionUpgradeModal open={showSubscribe} onOpenChange={setShowSubscribe} />

      <AnimatePresence mode="wait">
        {isHydrating && (
          <motion.div key="profile-loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="section-pad mb-6">
            <div className="animate-pulse space-y-3">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="rounded-2xl h-20" style={{ background: 'var(--cp-bg-card)' }} />
              ))}
            </div>
          </motion.div>
        )}
        {!isHydrating && activeTab === 'overview' && (
          <motion.div key="overview" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
            className="section-pad space-y-4 mb-6">
            {/* Profile Strength */}
            <div className="glass-card rounded-3xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 style={{ color: 'var(--cp-text-primary)', fontWeight: 700 }}>Profile Strength</h3>
                <span style={{ color: '#a78bfa', fontWeight: 700, fontSize: '1rem' }}>{profileCompletion}%</span>
              </div>
              <div className="space-y-2.5">
                {profileSections.map(section => (
                  <button
                    key={section.label}
                    onClick={() => section.action && router.push(section.action)}
                    className="w-full flex items-center gap-3"
                  >
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: section.done ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.05)', border: section.done ? '1px solid rgba(16,185,129,0.3)' : '1px solid rgba(255,255,255,0.08)' }}>
                      <span style={{ fontSize: '0.75rem' }}>{section.done ? '✓' : section.icon}</span>
                    </div>
                    <span style={{ flex: 1, color: section.done ? 'var(--cp-text-muted)' : 'var(--cp-text-primary)', fontSize: '0.82rem', textAlign: 'left', textDecoration: section.done ? 'line-through' : 'none' }}>
                      {section.label}
                    </span>
                    {!section.done && (
                      <div className="flex items-center gap-1 shrink-0">
                        <span style={{ color: '#f59e0b', fontSize: '0.72rem', fontWeight: 600 }}>+{section.xp}%</span>
                        {section.action && <ChevronRight size={13} color="#475569" />}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Profile details */}
            <div className="glass-card rounded-3xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 style={{ color: 'var(--cp-text-primary)', fontWeight: 700 }}>Career Details</h3>
                {!editingCareer && (
                  <button
                    onClick={() => {
                      setCareerDraft({
                        currentRole: user.currentRole,
                        targetRole: user.targetRole,
                        experience: user.experience,
                        education: user.education,
                        preferredIndustry: user.preferredIndustry,
                        careerGoal: user.careerGoal,
                        salaryGoal: user.salaryGoal,
                        salaryGoalCurrency: user.salaryGoalCurrency || 'USD',
                        salaryGoalFrequency: user.salaryGoalFrequency || 'Annual',
                      });
                      setEditingCareer(true);
                    }}
                    className="rounded-xl px-3 py-1.5"
                    style={{ background: 'rgba(124,58,237,0.2)', border: '1px solid rgba(124,58,237,0.35)', color: '#a78bfa', fontSize: '0.75rem', cursor: 'pointer' }}
                  >
                    <Edit3 size={12} style={{ display: 'inline', marginRight: 4 }} />Edit
                  </button>
                )}
              </div>

              {editingCareer ? (
                <div className="space-y-3">
                  {([
                    { key: 'currentRole', label: 'Current Role', placeholder: 'e.g. Software Engineer' },
                    { key: 'targetRole', label: 'Target Role', placeholder: 'e.g. Senior Product Manager' },
                    { key: 'experience', label: 'Experience', placeholder: 'e.g. 3 years' },
                    { key: 'education', label: 'Education', placeholder: 'e.g. B.Tech Computer Science' },
                    { key: 'preferredIndustry', label: 'Industry', placeholder: 'e.g. Technology' },
                    { key: 'salaryGoal', label: 'Expected Salary', placeholder: 'e.g. 2000000' },
                  ] as { key: keyof typeof careerDraft; label: string; placeholder: string }[]).map(f => (
                    <div key={f.key}>
                      <label style={{ color: 'var(--cp-text-muted)', fontSize: '0.72rem' }}>{f.label}</label>
                      <input
                        value={careerDraft[f.key] ?? ''}
                        onChange={e => setCareerDraft(p => ({ ...p, [f.key]: e.target.value }))}
                        placeholder={f.placeholder}
                        className="cp-input mt-1 w-full text-sm"
                      />
                    </div>
                  ))}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label style={{ color: 'var(--cp-text-muted)', fontSize: '0.72rem' }}>Goal Currency</label>
                      <select
                        value={careerDraft.salaryGoalCurrency}
                        onChange={e => setCareerDraft(p => ({ ...p, salaryGoalCurrency: e.target.value }))}
                        className="cp-input mt-1 w-full text-sm"
                      >
                        {['USD', 'INR', 'EUR', 'GBP'].map(c => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={{ color: 'var(--cp-text-muted)', fontSize: '0.72rem' }}>Goal Salary Type</label>
                      <select
                        value={careerDraft.salaryGoalFrequency}
                        onChange={e => setCareerDraft(p => ({ ...p, salaryGoalFrequency: e.target.value }))}
                        className="cp-input mt-1 w-full text-sm"
                      >
                        <option value="Annual">Annual</option>
                        <option value="Monthly">Monthly</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label style={{ color: 'var(--cp-text-muted)', fontSize: '0.72rem' }}>Career Goal</label>
                    <textarea
                      value={careerDraft.careerGoal ?? ''}
                      onChange={e => setCareerDraft(p => ({ ...p, careerGoal: e.target.value }))}
                      placeholder="Describe your career aspiration..."
                      rows={3}
                      className="cp-input mt-1 w-full text-sm"
                      style={{ resize: 'vertical' }}
                    />
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button
                      disabled={careerSaving}
                      onClick={async () => {
                        setCareerSaving(true);
                        setCareerError('');
                        try {
                          const ok = await updateProfile(careerDraft);
                          if (!ok) throw new Error('Failed to save career details');
                          await refresh();
                          setEditingCareer(false);
                        } catch (err) {
                          setCareerError(err instanceof Error ? err.message : 'Save failed');
                        } finally {
                          setCareerSaving(false);
                        }
                      }}
                      className="btn-primary flex-1 rounded-xl py-2.5"
                      style={{ fontSize: '0.85rem', fontWeight: 600, opacity: careerSaving ? 0.7 : 1 }}
                    >
                      {careerSaving ? 'Saving…' : 'Save Changes'}
                    </button>
                    <button
                      onClick={() => setEditingCareer(false)}
                      className="flex-1 rounded-xl py-2.5"
                      style={{ background: 'var(--cp-bg-elevated)', border: '1px solid var(--cp-border)', color: 'var(--cp-text-muted)', fontSize: '0.85rem', cursor: 'pointer' }}
                    >
                      Cancel
                    </button>
                  </div>
                  {careerError ? (
                    <p role="alert" className="text-sm mt-2" style={{ color: 'var(--cp-danger)' }}>{careerError}</p>
                  ) : null}
                </div>
              ) : (
                <div className="space-y-3">
                  {[
                    { label: 'Current Role', value: user.currentRole || '—' },
                    { label: 'Target Role', value: user.targetRole || '—' },
                    { label: 'Experience', value: user.experience || '—' },
                    { label: 'Education', value: user.education || '—' },
                    { label: 'Industry', value: user.preferredIndustry || '—' },
                    {
                      label: 'Salary Goal',
                      value: user.salaryGoal
                        ? `${user.salaryGoalCurrency === 'INR' ? '₹' : user.salaryGoalCurrency === 'EUR' ? '€' : user.salaryGoalCurrency === 'GBP' ? '£' : '$'}${Number(user.salaryGoal).toLocaleString()} (${user.salaryGoalFrequency})`
                        : '—',
                    },
                    { label: 'Career Goal', value: user.careerGoal || '—' },
                  ].map(d => (
                    <div key={d.label} className="flex items-start justify-between gap-3">
                      <span style={{ color: 'var(--cp-text-muted)', fontSize: '0.82rem', flexShrink: 0 }}>{d.label}</span>
                      <span style={{ color: d.value !== '—' ? 'var(--cp-text-primary)' : 'var(--cp-text-faint)', fontSize: '0.82rem', fontWeight: 500, textAlign: 'right', wordBreak: 'break-word' }}>
                        {d.value}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Social links */}
            <div className="glass-card rounded-3xl p-5">
              <h3 style={{ color: 'var(--cp-text-primary)', fontWeight: 700, marginBottom: '12px' }}>Social Profiles</h3>
              {([
                { key: 'linkedIn' as const, label: 'LinkedIn', value: user.linkedIn, icon: '🔗', color: '#0077b5', hint: 'linkedin.com/in/' },
                { key: 'github' as const, label: 'GitHub', value: user.github, icon: '🐙', color: '#a78bfa', hint: 'github.com/' },
              ]).map(link => (
                <div key={link.label} className="mb-3 last:mb-0">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: `${link.color}15`, border: `1px solid ${link.color}30` }}>
                      <span style={{ fontSize: '1rem' }}>{link.icon}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div style={{ color: 'var(--cp-text-muted)', fontSize: '0.72rem' }}>{link.label}</div>
                      <div style={{ color: link.value ? 'var(--cp-text-primary)' : 'var(--cp-text-faint)', fontSize: '0.82rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {link.value || 'Not added'}
                      </div>
                    </div>
                    {link.value ? (
                      <button
                        onClick={() => { setEditingLink(link.key); setLinkDraft(link.value); setLinkError(''); }}
                        className="shrink-0"
                      >
                        <Edit3 size={15} color="#475569" />
                      </button>
                    ) : (
                      <button
                        onClick={() => { setEditingLink(link.key); setLinkDraft(''); setLinkError(''); }}
                        className="rounded-xl px-3 py-1.5 shrink-0"
                        style={{ background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.3)', color: '#a78bfa', fontSize: '0.75rem' }}
                      >
                        + Add
                      </button>
                    )}
                  </div>
                  {editingLink === link.key && (
                    <div className="mt-2 space-y-2">
                      <input
                        value={linkDraft}
                        onChange={e => { setLinkDraft(e.target.value); setLinkError(''); }}
                        placeholder={`e.g. https://${link.hint}yourhandle`}
                        className="w-full rounded-xl px-3 py-2.5 outline-none text-sm"
                        style={{ background: 'var(--cp-bg-elevated)', border: `1px solid ${linkError ? '#f43f5e' : 'var(--cp-border)'}`, color: 'var(--cp-text-primary)' }}
                        autoFocus
                      />
                      {linkError && <p style={{ color: '#f43f5e', fontSize: '0.72rem' }}>{linkError}</p>}
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            const val = linkDraft.trim();
                            if (val) {
                              const lower = val.toLowerCase();
                              if (link.key === 'linkedIn' && !lower.includes('linkedin.com/in/')) {
                                setLinkError('URL must contain linkedin.com/in/');
                                return;
                              }
                              if (link.key === 'github' && !lower.includes('github.com/')) {
                                setLinkError('URL must contain github.com/');
                                return;
                              }
                            }
                            updateProfile({ [link.key]: val || '' });
                            setEditingLink(null);
                            setLinkError('');
                          }}
                          className="btn-primary flex-1 rounded-xl py-2"
                          style={{ fontSize: '0.82rem', fontWeight: 600 }}
                        >
                          Save
                        </button>
                        <button
                          onClick={() => { setEditingLink(null); setLinkError(''); }}
                          className="flex-1 rounded-xl py-2"
                          style={{ background: 'var(--cp-bg-elevated)', border: '1px solid var(--cp-border)', color: 'var(--cp-text-muted)', fontSize: '0.82rem' }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Salary & Location */}
            <div className="glass-card rounded-3xl p-5 mt-4">
              <div className="flex items-center justify-between mb-3">
                <h3 style={{ color: 'var(--cp-text-primary)', fontWeight: 700 }}>Salary & Location</h3>
                {!editingSalary && (
                  <button
                    onClick={() => setEditingSalary(true)}
                    className="rounded-xl px-3 py-1.5"
                    style={{ background: 'var(--cp-accent-bg)', border: '1px solid var(--cp-border-accent)', color: 'var(--cp-accent-light)', fontSize: '0.75rem' }}
                  >
                    Edit
                  </button>
                )}
              </div>

              {editingSalary ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label style={{ color: 'var(--cp-text-muted)', fontSize: '0.72rem' }}>Current Salary</label>
                      <input
                        value={salaryDraft.currentSalary}
                        onChange={e => setSalaryDraft(p => ({ ...p, currentSalary: e.target.value }))}
                        placeholder="e.g. 800000"
                        className="cp-input mt-1 text-sm"
                      />
                    </div>
                    <div>
                      <label style={{ color: 'var(--cp-text-muted)', fontSize: '0.72rem' }}>Currency</label>
                      <select
                        value={salaryDraft.salaryCurrency}
                        onChange={e => setSalaryDraft(p => ({ ...p, salaryCurrency: e.target.value }))}
                        className="cp-input mt-1 text-sm"
                      >
                        <option value="INR">INR (₹)</option>
                        <option value="USD">USD ($)</option>
                        <option value="EUR">EUR (€)</option>
                        <option value="GBP">GBP (£)</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label style={{ color: 'var(--cp-text-muted)', fontSize: '0.72rem' }}>Frequency</label>
                      <select
                        value={salaryDraft.salaryFrequency}
                        onChange={e => setSalaryDraft(p => ({ ...p, salaryFrequency: e.target.value }))}
                        className="cp-input mt-1 text-sm"
                      >
                        <option value="Annual">Annual</option>
                        <option value="Monthly">Monthly</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ color: 'var(--cp-text-muted)', fontSize: '0.72rem' }}>Type</label>
                      <select
                        value={salaryDraft.compensationType}
                        onChange={e => setSalaryDraft(p => ({ ...p, compensationType: e.target.value }))}
                        className="cp-input mt-1 text-sm"
                      >
                        <option value="">Select...</option>
                        <option value="Fixed">Fixed</option>
                        <option value="CTC">CTC</option>
                        <option value="Hourly">Hourly</option>
                        <option value="Contract">Contract</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label style={{ color: 'var(--cp-text-muted)', fontSize: '0.72rem' }}>Country</label>
                      <input
                        value={salaryDraft.country}
                        onChange={e => setSalaryDraft(p => ({ ...p, country: e.target.value }))}
                        placeholder="e.g. India"
                        className="cp-input mt-1 text-sm"
                      />
                    </div>
                    <div>
                      <label style={{ color: 'var(--cp-text-muted)', fontSize: '0.72rem' }}>Location</label>
                      <input
                        value={salaryDraft.locationPreference}
                        onChange={e => setSalaryDraft(p => ({ ...p, locationPreference: e.target.value }))}
                        placeholder="e.g. Bangalore, Remote"
                        className="cp-input mt-1 text-sm"
                      />
                    </div>
                  </div>
                  {salaryError ? (
                    <p role="alert" className="text-sm" style={{ color: 'var(--cp-danger)' }}>{salaryError}</p>
                  ) : null}
                  <button
                    disabled={salarySaving}
                    onClick={async () => {
                      setSalarySaving(true);
                      setSalaryError('');
                      try {
                        const ok = await updateProfile(salaryDraft);
                        if (!ok) throw new Error('Failed to save salary & location');
                        await refresh();
                        setEditingSalary(false);
                      } catch (err) {
                        setSalaryError(err instanceof Error ? err.message : 'Save failed');
                      } finally {
                        setSalarySaving(false);
                      }
                    }}
                    className="btn-primary w-full rounded-xl py-2.5"
                    style={{ fontSize: '0.85rem', fontWeight: 600, opacity: salarySaving ? 0.7 : 1 }}
                  >
                    {salarySaving ? 'Saving…' : 'Save Salary Info'}
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {[
                    { label: 'Current Salary', value: user.currentSalary ? `${user.salaryCurrency === 'INR' ? '₹' : '$'}${Number(user.currentSalary).toLocaleString()} (${user.salaryFrequency})` : '' },
                    { label: 'Compensation Type', value: user.compensationType },
                    { label: 'Country', value: user.country },
                    { label: 'Location', value: user.locationPreference },
                    { label: 'Salary Goal', value: user.salaryGoal },
                  ].map(d => (
                    <div key={d.label} className="flex items-center justify-between">
                      <span style={{ color: 'var(--cp-text-muted)', fontSize: '0.82rem' }}>{d.label}</span>
                      <span style={{ color: d.value ? 'var(--cp-text-primary)' : 'var(--cp-text-faint)', fontSize: '0.82rem', fontWeight: 500 }}>{d.value || '—'}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {/* Certifications */}
            <div className="glass-card rounded-3xl p-5 mt-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Award size={16} color="#f59e0b" />
                  <h3 style={{ color: 'var(--cp-text-primary)', fontWeight: 700 }}>Certifications</h3>
                  {user.certifications.length > 0 && (
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}>
                      {user.certifications.length}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => { setShowAddCert(v => !v); setCertError(''); setCertDraft({ ...blankCert }); }}
                  className="rounded-xl px-3 py-1.5 flex items-center gap-1.5"
                  style={{ background: 'rgba(124,58,237,0.2)', border: '1px solid rgba(124,58,237,0.35)', color: '#a78bfa', fontSize: '0.75rem', cursor: 'pointer' }}
                >
                  <Plus size={12} />
                  Add
                </button>
              </div>

              {/* Add form */}
              {showAddCert && (
                <div className="rounded-2xl p-4 mb-3 space-y-2.5" style={{ background: 'var(--cp-bg-elevated)', border: '1px solid var(--cp-border)' }}>
                  <h4 style={{ color: 'var(--cp-text-primary)', fontWeight: 600, fontSize: '0.85rem', marginBottom: 4 }}>New Certification</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label style={{ color: 'var(--cp-text-muted)', fontSize: '0.72rem' }}>Name *</label>
                      <input value={certDraft.name} onChange={e => setCertDraft(p => ({ ...p, name: e.target.value }))} placeholder="e.g. AWS Solutions Architect" className="cp-input mt-1 w-full text-sm" />
                    </div>
                    <div>
                      <label style={{ color: 'var(--cp-text-muted)', fontSize: '0.72rem' }}>Issuer *</label>
                      <input value={certDraft.issuer} onChange={e => setCertDraft(p => ({ ...p, issuer: e.target.value }))} placeholder="e.g. Amazon Web Services" className="cp-input mt-1 w-full text-sm" />
                    </div>
                    <div>
                      <label style={{ color: 'var(--cp-text-muted)', fontSize: '0.72rem' }}>Issue Date</label>
                      <input value={certDraft.issueDate} onChange={e => setCertDraft(p => ({ ...p, issueDate: e.target.value }))} placeholder="e.g. Jan 2024" className="cp-input mt-1 w-full text-sm" />
                    </div>
                    <div>
                      <label style={{ color: 'var(--cp-text-muted)', fontSize: '0.72rem' }}>Expiry Date</label>
                      <input value={certDraft.expiryDate} onChange={e => setCertDraft(p => ({ ...p, expiryDate: e.target.value }))} placeholder="e.g. Jan 2027 or No Expiry" className="cp-input mt-1 w-full text-sm" />
                    </div>
                    <div>
                      <label style={{ color: 'var(--cp-text-muted)', fontSize: '0.72rem' }}>Credential ID</label>
                      <input value={certDraft.credentialId} onChange={e => setCertDraft(p => ({ ...p, credentialId: e.target.value }))} placeholder="Optional" className="cp-input mt-1 w-full text-sm" />
                    </div>
                    <div>
                      <label style={{ color: 'var(--cp-text-muted)', fontSize: '0.72rem' }}>Credential URL</label>
                      <input value={certDraft.credentialUrl} onChange={e => setCertDraft(p => ({ ...p, credentialUrl: e.target.value }))} placeholder="https://..." className="cp-input mt-1 w-full text-sm" />
                    </div>
                  </div>
                  {certError && <p style={{ color: '#f43f5e', fontSize: '0.72rem' }}>{certError}</p>}
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => void saveCert(false)}
                      disabled={certSaving}
                      className="btn-primary flex-1 rounded-xl py-2"
                      style={{ fontSize: '0.82rem', fontWeight: 600, opacity: certSaving ? 0.7 : 1 }}
                    >
                      {certSaving ? 'Saving…' : 'Save Certification'}
                    </button>
                    <button
                      onClick={() => { setShowAddCert(false); setCertError(''); }}
                      className="flex-1 rounded-xl py-2"
                      style={{ background: 'var(--cp-bg-card)', border: '1px solid var(--cp-border)', color: 'var(--cp-text-muted)', fontSize: '0.82rem', cursor: 'pointer' }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Certification list */}
              {user.certifications.length === 0 && !showAddCert ? (
                <div className="text-center py-4">
                  <Award size={28} color="var(--cp-text-faint)" style={{ margin: '0 auto 8px' }} />
                  <p style={{ color: 'var(--cp-text-muted)', fontSize: '0.82rem' }}>No certifications yet. Add one to boost your profile strength.</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {user.certifications.map(cert => (
                    <div key={cert.id}>
                      {editingCertId === cert.id ? (
                        <div className="rounded-2xl p-3 space-y-2" style={{ background: 'var(--cp-bg-elevated)', border: '1px solid var(--cp-border)' }}>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <div>
                              <label style={{ color: 'var(--cp-text-muted)', fontSize: '0.72rem' }}>Name *</label>
                              <input value={editCertDraft.name ?? ''} onChange={e => setEditCertDraft(p => ({ ...p, name: e.target.value }))} className="cp-input mt-1 w-full text-sm" />
                            </div>
                            <div>
                              <label style={{ color: 'var(--cp-text-muted)', fontSize: '0.72rem' }}>Issuer *</label>
                              <input value={editCertDraft.issuer ?? ''} onChange={e => setEditCertDraft(p => ({ ...p, issuer: e.target.value }))} className="cp-input mt-1 w-full text-sm" />
                            </div>
                            <div>
                              <label style={{ color: 'var(--cp-text-muted)', fontSize: '0.72rem' }}>Issue Date</label>
                              <input value={editCertDraft.issueDate ?? ''} onChange={e => setEditCertDraft(p => ({ ...p, issueDate: e.target.value }))} className="cp-input mt-1 w-full text-sm" />
                            </div>
                            <div>
                              <label style={{ color: 'var(--cp-text-muted)', fontSize: '0.72rem' }}>Expiry</label>
                              <input value={editCertDraft.expiryDate ?? ''} onChange={e => setEditCertDraft(p => ({ ...p, expiryDate: e.target.value }))} className="cp-input mt-1 w-full text-sm" />
                            </div>
                            <div>
                              <label style={{ color: 'var(--cp-text-muted)', fontSize: '0.72rem' }}>Credential ID</label>
                              <input value={editCertDraft.credentialId ?? ''} onChange={e => setEditCertDraft(p => ({ ...p, credentialId: e.target.value }))} className="cp-input mt-1 w-full text-sm" />
                            </div>
                            <div>
                              <label style={{ color: 'var(--cp-text-muted)', fontSize: '0.72rem' }}>URL</label>
                              <input value={editCertDraft.credentialUrl ?? ''} onChange={e => setEditCertDraft(p => ({ ...p, credentialUrl: e.target.value }))} className="cp-input mt-1 w-full text-sm" />
                            </div>
                          </div>
                          {certError && <p style={{ color: '#f43f5e', fontSize: '0.72rem' }}>{certError}</p>}
                          <div className="flex gap-2 pt-1">
                            <button onClick={() => void saveCert(true)} disabled={certSaving} className="btn-primary flex-1 rounded-xl py-1.5" style={{ fontSize: '0.78rem', fontWeight: 600, opacity: certSaving ? 0.7 : 1 }}>
                              {certSaving ? 'Saving…' : 'Update'}
                            </button>
                            <button onClick={() => { setEditingCertId(null); setCertError(''); }} className="flex-1 rounded-xl py-1.5" style={{ background: 'var(--cp-bg-card)', border: '1px solid var(--cp-border)', color: 'var(--cp-text-muted)', fontSize: '0.78rem', cursor: 'pointer' }}>
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="rounded-2xl px-4 py-3 flex items-start gap-3" style={{ background: 'var(--cp-bg-card)', border: '1px solid var(--cp-border)' }}>
                          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5" style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)' }}>
                            <Award size={16} color="#f59e0b" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div style={{ color: 'var(--cp-text-primary)', fontWeight: 600, fontSize: '0.85rem' }}>{cert.name}</div>
                            <div style={{ color: 'var(--cp-text-muted)', fontSize: '0.75rem' }}>{cert.issuer}</div>
                            {(cert.issueDate || cert.expiryDate) && (
                              <div style={{ color: 'var(--cp-text-faint)', fontSize: '0.7rem', marginTop: '2px' }}>
                                {cert.issueDate}{cert.expiryDate ? ` – ${cert.expiryDate}` : ''}
                              </div>
                            )}
                            {cert.credentialUrl && (
                              <a href={cert.credentialUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 mt-1" style={{ color: '#a78bfa', fontSize: '0.7rem' }}>
                                <ExternalLink size={10} />
                                View credential
                              </a>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              onClick={() => { setEditingCertId(cert.id); setEditCertDraft({ name: cert.name, issuer: cert.issuer, issueDate: cert.issueDate ?? '', expiryDate: cert.expiryDate ?? '', credentialId: cert.credentialId ?? '', credentialUrl: cert.credentialUrl ?? '' }); setCertError(''); }}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', opacity: 0.6 }}
                              onMouseEnter={e => ((e.currentTarget as HTMLElement).style.opacity = '1')}
                              onMouseLeave={e => ((e.currentTarget as HTMLElement).style.opacity = '0.6')}
                            >
                              <Edit3 size={14} color="var(--cp-text-muted)" />
                            </button>
                            <button
                              onClick={() => void deleteCert(cert.id)}
                              disabled={deletingCertId === cert.id}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', opacity: deletingCertId === cert.id ? 0.3 : 0.6 }}
                              onMouseEnter={e => { if (deletingCertId !== cert.id) (e.currentTarget as HTMLElement).style.opacity = '1'; }}
                              onMouseLeave={e => ((e.currentTarget as HTMLElement).style.opacity = '0.6')}
                            >
                              <Trash2 size={14} color="#f43f5e" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}

        {!isHydrating && activeTab === 'courses' && (
          <motion.div key="courses" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="section-pad mb-6">
            <ProfileCoursesTab />
          </motion.div>
        )}

        {!isHydrating && activeTab === 'certificates' && (
          <motion.div key="certificates" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="section-pad mb-6">
            <ProfileCertificatesTab />
          </motion.div>
        )}

        {!isHydrating && activeTab === 'savedJobs' && (
          <motion.div key="savedJobs" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="section-pad mb-6">
            <ProfileSavedJobsTab />
          </motion.div>
        )}

        {!isHydrating && activeTab === 'appliedJobs' && (
          <motion.div key="appliedJobs" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="section-pad mb-6">
            <ProfileAppliedJobsTab />
          </motion.div>
        )}

        {!isHydrating && activeTab === 'resumes' && (
          <motion.div key="resumes" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="section-pad mb-6">
            <ProfileResumesTab />
          </motion.div>
        )}

        {!isHydrating && activeTab === 'badges' && (
          <motion.div key="badges" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
            className="section-pad mb-6">
            {/* Earned */}
            <h3 style={{ color: 'var(--cp-text-primary)', fontWeight: 700, marginBottom: '12px' }}>
              Earned <span style={{ color: 'var(--cp-text-faint)' }}>({earnedBadges.length})</span>
            </h3>
            <div className="responsive-grid-2 mb-5">
              {earnedBadges.map((badge, i) => (
                <motion.div
                  key={badge.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.07 }}
                  className="rounded-2xl p-4 flex items-start gap-3"
                  style={{ background: rarityBg[badge.rarity], border: `1px solid ${rarityColors[badge.rarity]}30` }}
                >
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shrink-0"
                    style={{
                      background: badge.rarity === 'legendary' ? 'linear-gradient(135deg, #f59e0b, #fbbf24)' :
                        badge.rarity === 'epic' ? 'linear-gradient(135deg, #7c3aed, #a78bfa)' :
                        badge.rarity === 'rare' ? 'linear-gradient(135deg, #0891b2, #06b6d4)' :
                        'rgba(255,255,255,0.08)',
                      boxShadow: badge.rarity === 'legendary' ? '0 0 12px rgba(245,158,11,0.4)' :
                        badge.rarity === 'epic' ? '0 0 12px rgba(124,58,237,0.4)' : 'none',
                    }}>
                    {badge.emoji}
                  </div>
                  <div>
                    <div style={{ color: rarityColors[badge.rarity], fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: '2px' }}>
                      {badge.rarity}
                    </div>
                    <div style={{ color: 'var(--cp-text-primary)', fontWeight: 600, fontSize: '0.82rem' }}>{badge.name}</div>
                    <div style={{ color: 'var(--cp-text-muted)', fontSize: '0.68rem', marginTop: '2px' }}>{badge.description}</div>
                    <div className="flex items-center gap-1 mt-1.5">
                      <Zap size={10} color="#f59e0b" />
                      <span style={{ color: '#f59e0b', fontSize: '0.65rem' }}>+{badge.xpReward} XP</span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Locked badges */}
            <h3 style={{ color: 'var(--cp-text-primary)', fontWeight: 700, marginBottom: '12px' }}>
              Locked <span style={{ color: 'var(--cp-text-faint)' }}>({lockedBadges.length})</span>
            </h3>
            <div className="responsive-grid-2">
              {lockedBadges.map((badge, i) => (
                <div
                  key={badge.id}
                  className="rounded-2xl p-4 flex items-start gap-3 opacity-50"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--cp-border)' }}
                >
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shrink-0 grayscale"
                    style={{ background: 'var(--cp-bg-elevated)', filter: 'grayscale(1) blur(1px)' }}>
                    {badge.emoji}
                  </div>
                  <div>
                    <div style={{ color: 'var(--cp-text-faint)', fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: '2px' }}>
                      {badge.rarity}
                    </div>
                    <div style={{ color: 'var(--cp-text-muted)', fontWeight: 600, fontSize: '0.82rem' }}>{badge.name}</div>
                    <div style={{ color: 'var(--cp-text-faint)', fontSize: '0.68rem', marginTop: '2px' }}>{badge.description}</div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {!isHydrating && activeTab === 'skills' && (
          <motion.div key="skills" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
            className="section-pad mb-6">
            <div className="glass-card rounded-3xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 style={{ color: 'var(--cp-text-primary)', fontWeight: 700 }}>Your Skills</h3>
                <button
                  onClick={() => setEditingSkills(!editingSkills)}
                  className="rounded-xl px-3 py-1.5"
                  style={{ background: 'rgba(124,58,237,0.2)', border: '1px solid rgba(124,58,237,0.3)', color: '#a78bfa', fontSize: '0.78rem' }}
                >
                  {editingSkills ? 'Done' : '+ Add'}
                </button>
              </div>

              {editingSkills && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mb-4">
                  <div className="flex gap-2">
                    <input
                      value={newSkill}
                      onChange={e => setNewSkill(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && addSkill()}
                      placeholder="Add skill (e.g. GraphQL)"
                      className="flex-1 rounded-xl px-3 py-2.5 outline-none text-sm"
                      style={{ background: 'var(--cp-bg-elevated)', border: '1px solid var(--cp-border)', color: 'var(--cp-text-primary)' }}
                    />
                    <button onClick={addSkill} className="btn-primary rounded-xl px-4">
                      <Plus size={16} />
                    </button>
                  </div>
                </motion.div>
              )}

              <div className="flex flex-wrap gap-2">
                {user.skills.map((skill, i) => (
                  <motion.div
                    key={skill}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: i * 0.04 }}
                    className="flex items-center gap-2 rounded-xl px-3 py-2"
                    style={{ background: 'rgba(124,58,237,0.12)', border: '1px solid rgba(124,58,237,0.25)' }}
                  >
                    <span style={{ color: '#a78bfa', fontSize: '0.82rem' }}>{skill}</span>
                    {editingSkills && (
                      <button onClick={() => updateProfile({ skills: user.skills.filter(s => s !== skill) })}>
                        <span style={{ color: 'var(--cp-text-faint)', fontSize: '0.75rem' }}>×</span>
                      </button>
                    )}
                  </motion.div>
                ))}
              </div>

              {user.skills.length === 0 && (
                <p style={{ color: 'var(--cp-text-faint)', fontSize: '0.85rem', textAlign: 'center', padding: '20px 0' }}>
                  No skills added yet. Click "+ Add" to get started!
                </p>
              )}
            </div>

            {/* Missing skills recommendations */}
            <RecommendedSkillsPanel />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
