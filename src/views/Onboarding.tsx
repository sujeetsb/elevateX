'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import { Upload, ChevronRight, ChevronLeft, Check, Zap, Plus, X, FileText, Loader2 } from 'lucide-react';
import { useGame } from '../components/GameContext';
import { CareerDialog } from '../components/CareerDialog';
import { DialogTitle } from '../components/ui/dialog';
import { ResumeUploadButton } from '@/lib/uploadthing/components';
import type { ResumeParseResult } from '@/types/resume-parse-result';
import { mapResumeParsedJsonToOnboardingPrefill } from '@/lib/onboarding/map-resume-parsed-json';
import { STORAGE_KEYS, APP_NAME } from '@/lib/brand';
import { BrandLogo } from '@/components/BrandLogo';

const steps = ['Start', 'Basics', 'Career', 'Goals', 'Done'];

const PREFERRED_INDUSTRIES = [
  'Technology',
  'Banking',
  'Agriculture',
  'Construction',
  'Civil',
  'Mechanical',
  'Healthcare',
  'Education',
  'Finance',
  'Commercial',
  'Government',
  'Retail',
  'Manufacturing',
  'Logistics',
  'Automobile',
  'Energy',
  'Telecommunication',
  'Hospitality',
  'Legal',
  'Others',
] as const;
const DRAFT_KEY = STORAGE_KEYS.onboardingDraft;
const DRAFT_KEY_LEGACY = STORAGE_KEYS.onboardingDraftLegacy;

type DraftShape = {
  step: number;
  name: string;
  email: string;
  currentRole: string;
  experience: string;
  skillInput: string;
  skills: string[];
  careerGoal: string;
  targetRole: string;
  industry: string;
  industries: string[];
  resumeUploaded: boolean;
  profileSummary: string;
};

function readDraft(): Partial<DraftShape> | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(DRAFT_KEY) ?? localStorage.getItem(DRAFT_KEY_LEGACY);
    if (!raw) return null;
    return JSON.parse(raw) as Partial<DraftShape>;
  } catch {
    return null;
  }
}

function writeDraft(d: DraftShape) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(d));
  } catch {
    // ignore
  }
}

export function Onboarding() {
  const router = useRouter();
  const { addXP, xp, level, levelName, isAuthenticated, isOnboarded, isHydrating, refresh } = useGame();
  const resumeXpGranted = useRef(false);

  const [step, setStep] = useState(0);
  const [resumeUploaded, setResumeUploaded] = useState(false);
  const [resumeParsing, setResumeParsing] = useState(false);
  const [resumeParseStatus, setResumeParseStatus] = useState<string | null>(null);
  const [resumeConfidence, setResumeConfidence] = useState<number | null>(null);
  const [resumeError, setResumeError] = useState<string | null>(null);
  const [showPasteDialog, setShowPasteDialog] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [pasteBusy, setPasteBusy] = useState(false);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [currentRole, setCurrentRole] = useState('');
  const [experience, setExperience] = useState('');
  const [skillInput, setSkillInput] = useState('');
  const [skills, setSkills] = useState<string[]>([]);
  const [careerGoal, setCareerGoal] = useState('');
  const [targetRole, setTargetRole] = useState('');
  const [industry, setIndustry] = useState('');
  const [industries, setIndustries] = useState<string[]>([]);
  const [profileSummary, setProfileSummary] = useState('');
  const [stepError, setStepError] = useState<string | null>(null);

  const [showCelebration, setShowCelebration] = useState(false);
  const [draftHydrated, setDraftHydrated] = useState(false);
  const [submittingProfile, setSubmittingProfile] = useState(false);

  const [aiGoalSuggestions, setAiGoalSuggestions] = useState<string[]>([]);
  const [aiGoalLoading, setAiGoalLoading] = useState(false);
  const [aiGoalError, setAiGoalError] = useState<string | null>(null);
  const [aiRoleSuggestions, setAiRoleSuggestions] = useState<string[]>([]);
  const [aiRoleLoading, setAiRoleLoading] = useState(false);

  useEffect(() => {
    const d = readDraft();
    if (d) {
      if (typeof d.step === 'number') setStep(d.step);
      if (typeof d.name === 'string') setName(d.name);
      if (typeof d.email === 'string') setEmail(d.email);
      if (typeof d.currentRole === 'string') setCurrentRole(d.currentRole);
      if (typeof d.experience === 'string') setExperience(d.experience);
      if (typeof d.skillInput === 'string') setSkillInput(d.skillInput);
      if (Array.isArray(d.skills)) setSkills(d.skills);
      if (typeof d.careerGoal === 'string') setCareerGoal(d.careerGoal);
      if (typeof d.targetRole === 'string') setTargetRole(d.targetRole);
      if (typeof d.industry === 'string') setIndustry(d.industry);
      if (Array.isArray(d.industries)) setIndustries(d.industries);
      if (typeof d.resumeUploaded === 'boolean') setResumeUploaded(d.resumeUploaded);
      if (typeof d.profileSummary === 'string') setProfileSummary(d.profileSummary);
    }
    setDraftHydrated(true);
  }, []);

  useEffect(() => {
    if (isHydrating) return;
    if (!isAuthenticated) {
      router.replace('/');
    }
  }, [isHydrating, isAuthenticated, router]);

  useEffect(() => {
    if (isAuthenticated && isOnboarded) {
      router.replace('/app/dashboard');
    }
  }, [isAuthenticated, isOnboarded, router]);

  useEffect(() => {
    if (!draftHydrated) return;
    const timer = window.setTimeout(() => {
      writeDraft({
        step,
        name,
        email,
        currentRole,
        experience,
        skillInput,
        skills,
        careerGoal,
        targetRole,
        industry,
        industries,
        resumeUploaded,
        profileSummary,
      });
    }, 450);
    return () => window.clearTimeout(timer);
  }, [
    draftHydrated,
    step,
    name,
    email,
    currentRole,
    experience,
    skillInput,
    skills,
    careerGoal,
    targetRole,
    industry,
    industries,
    resumeUploaded,
    profileSummary,
  ]);

  const mergeParsed = useCallback((parsed: ResumeParseResult) => {
    // Quick-parse result: only fill fields that are currently empty (user may have typed already)
    if (parsed.name?.trim()) setName(prev => (prev.trim() ? prev : parsed.name!.trim()));
    if (parsed.email?.trim()) setEmail(prev => (prev.trim() ? prev : parsed.email!.trim()));
    if (parsed.currentRole?.trim()) setCurrentRole(prev => (prev.trim() ? prev : parsed.currentRole!.trim()));
    if (parsed.targetRole?.trim()) setTargetRole(prev => (prev.trim() ? prev : parsed.targetRole!.trim()));
    if (parsed.experience?.trim()) setExperience(prev => (prev.trim() ? prev : parsed.experience!.trim()));
    if (parsed.careerGoal?.trim()) setCareerGoal(prev => (prev.trim() ? prev : parsed.careerGoal!.trim()));
    if (parsed.summary?.trim()) setProfileSummary(prev => (prev.trim() ? prev : parsed.summary!.trim()));
    if (parsed.skills?.length) {
      setSkills(prev => {
        const merged = [...prev];
        for (const s of parsed.skills) {
          const t = s.trim();
          if (t && !merged.some(x => x.toLowerCase() === t.toLowerCase())) merged.push(t);
        }
        return merged;
      });
    }
  }, []);

  const applyPrefillFromParsedJson = useCallback((parsedJson: unknown) => {
    const pre = mapResumeParsedJsonToOnboardingPrefill(parsedJson);
    // This is called from the high-quality background AI parse (inngest job), which is more
    // accurate than the initial quick-parse from mergeParsed. Always overwrite auto-filled
    // values so the richer data wins. User-edited values are indistinguishable here, but the
    // background parse typically completes within seconds of the quick-parse.
    if (pre.name) setName(pre.name);
    if (pre.email) setEmail(pre.email);
    if (pre.currentRole) setCurrentRole(pre.currentRole);
    if (pre.targetRole) setTargetRole(pre.targetRole);
    if (pre.experience) setExperience(pre.experience);
    if (pre.skills?.length) {
      setSkills(prev => {
        const merged = [...prev];
        for (const s of pre.skills!) {
          const t = s.trim();
          if (t && !merged.some(x => x.toLowerCase() === t.toLowerCase())) merged.push(t);
        }
        return merged;
      });
    }
    if (pre.summary) setProfileSummary(pre.summary);
    if (pre.careerGoal) setCareerGoal(pre.careerGoal);
  }, []);

  const grantResumeXpOnce = () => {
    if (resumeXpGranted.current) return;
    resumeXpGranted.current = true;
    addXP(100);
  };

  const apiErrorMessage = useCallback((json: unknown, fallback: string) => {
    if (!json || typeof json !== 'object') return fallback;
    const j = json as Record<string, unknown>;
    if (typeof j.message === 'string') return j.message;
    const err = j.error;
    if (err && typeof err === 'object' && typeof (err as { message?: unknown }).message === 'string') {
      return (err as { message: string }).message;
    }
    return fallback;
  }, []);

  const runResumePipelineFromUt = async (
    files: { ufsUrl: string; key: string; name: string; type: string }[],
  ) => {
    const file = files[0];
    if (!file?.ufsUrl?.trim() || !file.key) return;
    setResumeError(null);
    setResumeParsing(true);
    setResumeConfidence(null);
    try {
      const parseRes = await fetch('/api/v1/onboarding/resume/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileUrl: file.ufsUrl,
          fileName: file.name,
          mimeType: file.type || undefined,
        }),
        credentials: 'include',
      });
      const parseJson = await parseRes.json().catch(() => ({}));
      if (!parseRes.ok) {
        throw new Error(apiErrorMessage(parseJson, 'Could not parse that file.'));
      }

      mergeParsed(parseJson.data);

      const uploadRes = await fetch('/api/v1/resumes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileUrl: file.ufsUrl,
          fileKey: file.key,
          fileName: file.name,
          mimeType: file.type || undefined,
        }),
        credentials: 'include',
      });
      const uploadJson = await uploadRes.json().catch(() => ({}));
      if (!uploadRes.ok) {
        throw new Error(apiErrorMessage(uploadJson, 'Could not save resume.'));
      }

      const resumeId = uploadJson?.data?.resumeId as string | undefined;
      setResumeUploaded(true);
      setStep(1);
      grantResumeXpOnce();

      if (resumeId) {
        setResumeParseStatus('PROCESSING');
        void (async () => {
          const startedAt = Date.now();
          while (Date.now() - startedAt < 60_000) {
            try {
              const sRes = await fetch(`/api/v1/resumes/${resumeId}`, { credentials: 'include' });
              const sJson = await sRes.json().catch(() => ({}));
              const status = sJson?.data?.parseStatus as string | undefined;
              if (status) setResumeParseStatus(status);
              if (status === 'COMPLETE') {
                const parsed = sJson?.data?.parsedJson;
                const conf = sJson?.data?.confidence as Record<string, unknown> | undefined;
                const overall = typeof conf?.overall === 'number' ? conf.overall : null;
                if (overall != null) setResumeConfidence(overall);

                applyPrefillFromParsedJson(parsed);
                await refresh();
                return;
              }
              if (status === 'FAILED') {
                setResumeError(sJson?.data?.parseError || 'Resume parsing failed.');
                return;
              }
            } catch (pollErr) {
              // keep polling until timeout
              if (pollErr instanceof Error) setResumeError(pollErr.message);
            }
            await new Promise(r => setTimeout(r, 2000));
          }
        })();
      }
    } catch (err) {
      setResumeError(err instanceof Error ? err.message : 'Could not read that file. Try PDF, DOCX, or TXT.');
    } finally {
      setResumeParsing(false);
    }
  };

  const handlePasteSubmit = async () => {
    if (!pasteText.trim()) return;
    setPasteBusy(true);
    setResumeError(null);
    setResumeConfidence(null);
    try {
      const parseRes = await fetch('/api/v1/onboarding/resume/parse-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: pasteText }),
        credentials: 'include',
      });
      const parseJson = await parseRes.json().catch(() => ({}));
      if (!parseRes.ok) {
        throw new Error(apiErrorMessage(parseJson, 'Could not parse pasted text.'));
      }
      mergeParsed(parseJson.data);

      const uploadRes = await fetch('/api/v1/resumes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawText: pasteText }),
        credentials: 'include',
      });
      const uploadJson = await uploadRes.json().catch(() => ({}));
      if (!uploadRes.ok) {
        throw new Error(apiErrorMessage(uploadJson, 'Could not upload resume.'));
      }

      const resumeId = uploadJson?.data?.resumeId as string | undefined;
      setResumeUploaded(true);
      grantResumeXpOnce();
      setShowPasteDialog(false);
      setPasteText('');
      setStep(1);

      if (resumeId) {
        setResumeParseStatus('PROCESSING');
        void (async () => {
          const startedAt = Date.now();
          while (Date.now() - startedAt < 60_000) {
            try {
              const sRes = await fetch(`/api/v1/resumes/${resumeId}`, { credentials: 'include' });
              const sJson = await sRes.json().catch(() => ({}));
              const status = sJson?.data?.parseStatus as string | undefined;
              if (status) setResumeParseStatus(status);
              if (status === 'COMPLETE') {
                const parsed = sJson?.data?.parsedJson;
                const conf = sJson?.data?.confidence as Record<string, unknown> | undefined;
                const overall = typeof conf?.overall === 'number' ? conf.overall : null;
                if (overall != null) setResumeConfidence(overall);

                applyPrefillFromParsedJson(parsed);
                await refresh();
                return;
              }
              if (status === 'FAILED') {
                setResumeError(sJson?.data?.parseError || 'Resume parsing failed.');
                return;
              }
            } catch (pollErr) {
              if (pollErr instanceof Error) setResumeError(pollErr.message);
            }
            await new Promise(r => setTimeout(r, 2000));
          }
        })();
      }
    } catch (err) {
      setResumeError(err instanceof Error ? err.message : 'Could not parse pasted text.');
    } finally {
      setPasteBusy(false);
    }
  };

  const addSkill = () => {
    if (skillInput.trim() && !skills.includes(skillInput.trim())) {
      setSkills(prev => [...prev, skillInput.trim()]);
      setSkillInput('');
    }
  };

  const removeSkill = (skill: string) => {
    setSkills(prev => prev.filter(s => s !== skill));
  };

  const validateStep = (): boolean => {
    setStepError(null);
    if (step === 1) {
      if (!name.trim() || !currentRole.trim() || !experience.trim()) {
        setStepError('Please fill in your name, current role, and experience.');
        return false;
      }
      if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        setStepError('Enter a valid email or leave it blank.');
        return false;
      }
    }
    if (step === 2) {
      if (skills.length < 1) {
        setStepError('Add at least one skill (or go back and import a resume).');
        return false;
      }
    }
    if (step === 3) {
      if (!targetRole.trim()) {
        setStepError('Pick or enter a target role.');
        return false;
      }
      if (industries.length === 0) {
        setStepError('Choose at least one preferred industry (max 3).');
        return false;
      }
      if (!careerGoal.trim()) {
        setStepError('Write a short career goal.');
        return false;
      }
    }
    return true;
  };

  const generateAiGoals = async () => {
    setAiGoalLoading(true);
    setAiGoalError(null);
    try {
      const res = await fetch('/api/v1/ai/career-goals/generate', { method: 'POST', credentials: 'include' });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? 'Failed');
      setAiGoalSuggestions(json.data?.suggestions ?? []);
    } catch {
      setAiGoalError('Could not generate suggestions. Try again.');
    } finally {
      setAiGoalLoading(false);
    }
  };

  const generateAiRoles = async () => {
    setAiRoleLoading(true);
    try {
      const res = await fetch('/api/v1/ai/target-roles/suggest', { method: 'POST', credentials: 'include' });
      const json = await res.json();
      if (!res.ok) throw new Error();
      setAiRoleSuggestions(json.data?.roles ?? []);
    } catch {
      // non-fatal
    } finally {
      setAiRoleLoading(false);
    }
  };

  const handleNext = async () => {
    if (!validateStep()) return;
    if (step < steps.length - 2) {
      setStep(prev => prev + 1);
      return;
    }
    if (submittingProfile) return;
    setSubmittingProfile(true);
    setResumeError(null);
    try {
      const res = await fetch('/api/v1/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim() || undefined,
          currentRole: currentRole.trim() || undefined,
          experienceYears: experience.trim() || undefined,
          skills: skills.length > 0 ? skills : undefined,
          careerGoal: careerGoal.trim() || undefined,
          targetRole: targetRole.trim() || undefined,
          preferredIndustry: industries[0]?.trim() || industry.trim() || undefined,
          preferredIndustries: industries.length > 0 ? industries : undefined,
          bio: profileSummary.trim() || undefined,
          onboardingComplete: true,
        }),
        credentials: 'include',
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(apiErrorMessage(json, 'Profile update failed'));
      }

      await refresh();

      try {
        localStorage.removeItem(DRAFT_KEY);
      } catch {
        // ignore
      }

      addXP(500);
      setShowCelebration(true);
      window.setTimeout(() => {
        router.push('/app/dashboard');
      }, 1600);
    } catch (err) {
      setResumeError(err instanceof Error ? err.message : 'Profile update failed');
    } finally {
      setSubmittingProfile(false);
    }
  };

  const progress = ((step + 1) / steps.length) * 100;
  const xpRewards = { 0: 100, 1: 20, 2: 50, 3: 50, 4: 500 } as const;

  // While session/profile is loading, show a neutral spinner instead of the
  // onboarding wizard. This prevents already-onboarded users from seeing the
  // wizard for a few hundred milliseconds before the redirect fires.
  if (isHydrating) {
    return (
      <div className="aurora-bg min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center glow-purple"
            style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)' }}>
            <span style={{ fontSize: '1.8rem' }}>🚀</span>
          </div>
          <div className="flex gap-1.5">
            {[0, 1, 2].map(i => (
              <div key={i} className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#7c3aed', animationDelay: `${i * 0.15}s` }} />
            ))}
          </div>
          <span style={{ color: 'var(--cp-text-muted)', fontSize: '0.85rem' }}>Loading your profile…</span>
        </div>
      </div>
    );
  }

  if (showCelebration) {
    return (
      <div className="aurora-bg min-h-screen flex items-center justify-center p-6">
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-center"
        >
          <motion.div
            animate={{ rotate: [0, 10, -10, 0], scale: [1, 1.2, 1] }}
            transition={{ repeat: Infinity, duration: 2 }}
            className="text-6xl mb-4"
          >🏆</motion.div>
          <h2 className="text-gradient" style={{ fontSize: '2rem', fontWeight: 700 }}>Profile Complete!</h2>
          <p style={{ color: 'var(--cp-text-muted)', marginTop: '8px' }}>+500 XP earned • Level Up!</p>
          <div className="glass-card rounded-2xl p-4 mt-6 inline-block">
            <div className="flex items-center gap-3">
              <div className="level-badge rounded-xl px-3 py-1">
                <span style={{ color: 'var(--cp-text-inverse)', fontWeight: 700, fontSize: '0.85rem' }}>LVL {level}</span>
              </div>
              <div>
                <div style={{ color: 'var(--cp-text-primary)', fontWeight: 600 }}>{levelName}</div>
                <div style={{ color: 'var(--cp-text-muted)', fontSize: '0.8rem' }}>{xp.toLocaleString()} XP total</div>
              </div>
            </div>
          </div>
          <p style={{ color: 'var(--cp-text-muted)', fontSize: '0.85rem', marginTop: '16px' }}>Launching your dashboard...</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="aurora-bg min-h-screen flex flex-col p-4 sm:p-6 lg:p-8" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
      <CareerDialog open={showPasteDialog} onOpenChange={setShowPasteDialog}>
        <DialogTitle className="sr-only">Paste resume text</DialogTitle>
        <p style={{ color: 'var(--cp-text-muted)', fontSize: '0.85rem', marginBottom: '12px' }}>
          Paste plain text from your resume. We will extract basics locally (mock) or via your API when configured.
        </p>
        <textarea
          value={pasteText}
          onChange={e => setPasteText(e.target.value)}
          rows={8}
          className="mb-4 w-full resize-none rounded-xl px-4 py-3 outline-none"
          style={{
            background: 'var(--cp-bg-elevated)',
            border: '1px solid var(--cp-border)',
            color: 'var(--cp-text-primary)',
            fontSize: '0.9rem',
          }}
          placeholder="Paste resume text here…"
        />
        <div className="flex gap-2">
          <button
            type="button"
            className="flex-1 rounded-xl py-3"
            style={{ background: 'var(--cp-bg-elevated)', border: '1px solid var(--cp-border)', color: 'var(--cp-text-muted)' }}
            onClick={() => {
              setShowPasteDialog(false);
              setPasteText('');
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary flex-1 flex items-center justify-center gap-2 rounded-xl py-3"
            disabled={!pasteText.trim() || pasteBusy}
            onClick={() => void handlePasteSubmit()}
          >
            {pasteBusy ? <Loader2 className="animate-spin" size={18} /> : null}
            Import
          </button>
        </div>
      </CareerDialog>

      <div className="w-full max-w-3xl mx-auto flex flex-col flex-1">
        <div className="flex items-center gap-3 mb-6">
          <BrandLogo size={32} nameClassName="text-base" />
        </div>

        <div className="mb-6">
          <div className="flex justify-between mb-2">
            <span style={{ color: 'var(--cp-text-muted)', fontSize: '0.8rem' }}>Step {step + 1} of {steps.length - 1}</span>
            <span className="text-gradient" style={{ fontWeight: 600, fontSize: '0.8rem' }}>
              +{xpRewards[step as keyof typeof xpRewards]} XP on complete
            </span>
          </div>
          <div className="rounded-full overflow-hidden" style={{ background: 'var(--cp-bg-elevated)', height: '6px' }}>
            <motion.div
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.5 }}
              className="xp-bar h-full rounded-full"
            />
          </div>
          <div className="flex justify-between mt-2">
            {steps.slice(0, -1).map((s, i) => (
              <div key={s} className="flex flex-col items-center gap-1">
                <div
                  className="w-5 h-5 rounded-full flex items-center justify-center"
                  style={{
                    background: i < step ? 'linear-gradient(135deg, #7c3aed, #4f46e5)' : i === step ? 'rgba(124,58,237,0.3)' : 'rgba(255,255,255,0.08)',
                    border: i === step ? '1px solid rgba(124,58,237,0.6)' : 'none',
                  }}
                >
                  {i < step ? <Check size={10} color="white" /> : null}
                </div>
                <span style={{ color: i <= step ? '#a78bfa' : '#475569', fontSize: '0.6rem' }}>{s}</span>
              </div>
            ))}
          </div>
        </div>

        {stepError && (
          <div
            className="mb-4 rounded-xl px-3 py-2 text-sm"
            style={{ background: 'rgba(244,63,94,0.12)', border: '1px solid rgba(244,63,94,0.35)', color: '#fda4af' }}
            role="alert"
          >
            {stepError}
          </div>
        )}

        <AnimatePresence>
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.3 }}
            className="flex-1"
          >
            {step === 0 && (
              <div>
                <h2 style={{ color: 'var(--cp-text-primary)', fontWeight: 700, fontSize: '1.4rem', marginBottom: '6px' }}>
                  Let's build your career profile 🚀
                </h2>
                <p style={{ color: 'var(--cp-text-muted)', fontSize: '0.9rem', marginBottom: '28px' }}>
                  Upload a resume for instant fields, paste text, or continue manually.
                </p>

                <div
                  className={`w-full rounded-3xl p-5 mb-4 text-left transition-all ${resumeUploaded ? 'glass-card-purple' : 'glass-card'}`}
                  style={{
                    border: resumeUploaded ? '1px solid rgba(124,58,237,0.4)' : '1px solid rgba(255,255,255,0.08)',
                  }}
                >
                  <div className="flex items-start gap-4">
                    <div
                      className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
                      style={{ background: resumeUploaded ? 'rgba(124,58,237,0.3)' : 'rgba(255,255,255,0.05)' }}
                    >
                      {resumeParsing ? (
                        <Loader2 className="animate-spin text-violet-300" size={24} />
                      ) : resumeUploaded ? (
                        <Check size={24} color="#a78bfa" />
                      ) : (
                        <Upload size={24} color="#64748b" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div style={{ color: 'var(--cp-text-primary)', fontWeight: 600, marginBottom: '4px' }}>
                        {resumeUploaded ? 'Resume imported' : 'Upload resume file'}
                      </div>
                      <div style={{ color: 'var(--cp-text-muted)', fontSize: '0.82rem' }}>
                        PDF, DOCX, or TXT via UploadThing — parsed with Gemini in the background.
                      </div>
                      {resumeParseStatus ? (
                        <div style={{ color: 'var(--cp-text-muted)', fontSize: '0.78rem', marginTop: '6px' }}>
                          Parsing status: {resumeParseStatus}
                        </div>
                      ) : null}
                      {resumeConfidence != null ? (
                        <div style={{ color: '#10b981', fontSize: '0.78rem', fontWeight: 700 }}>
                          Confidence: {Math.round(resumeConfidence * 100)}%
                        </div>
                      ) : null}
                      {!resumeUploaded && (
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          <span style={{ color: '#f59e0b', fontSize: '0.78rem', fontWeight: 600 }}>⚡ +100 XP</span>
                          <span style={{ color: '#10b981', fontSize: '0.78rem' }}>Recommended</span>
                        </div>
                      )}
                      {resumeUploaded && (
                        <div style={{ color: '#f59e0b', fontSize: '0.78rem', fontWeight: 600 }}>⚡ +100 XP earned</div>
                      )}
                      {!resumeUploaded && (
                        <div className="mt-3 max-w-xs" onClick={e => e.stopPropagation()}>
                          <ResumeUploadButton
                            endpoint="resume"
                            disabled={resumeParsing}
                            onClientUploadComplete={res => void runResumePipelineFromUt(res)}
                            onUploadError={e => setResumeError(e.message)}
                            appearance={{
                              button: 'bg-violet-600 hover:bg-violet-500 border-0 text-white rounded-xl px-4 py-2 text-sm font-semibold w-full',
                              allowedContent: 'text-xs mt-1 opacity-60',
                            }}
                            content={{ button: resumeParsing ? 'Working…' : 'Choose file' }}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowPasteDialog(true)}
                  className="glass-card mb-4 w-full rounded-3xl p-5 text-left transition-opacity hover:opacity-95"
                  style={{ border: '1px solid var(--cp-border)' }}
                >
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
                      style={{ background: 'var(--cp-bg-card)' }}>
                      <FileText size={22} color="#64748b" />
                    </div>
                    <div>
                      <div style={{ color: 'var(--cp-text-primary)', fontWeight: 600, marginBottom: '4px' }}>Paste resume text</div>
                      <div style={{ color: 'var(--cp-text-muted)', fontSize: '0.82rem' }}>No file? Paste plain text and we will fill basics.</div>
                    </div>
                  </div>
                </button>

                {resumeError && (
                  <p style={{ color: '#f87171', fontSize: '0.82rem', marginBottom: '12px' }} role="alert">{resumeError}</p>
                )}

                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="glass-card w-full rounded-3xl p-5 text-left"
                  style={{ border: '1px solid var(--cp-border)' }}
                >
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
                      style={{ background: 'var(--cp-bg-card)' }}>
                      <span style={{ fontSize: '1.4rem' }}>📝</span>
                    </div>
                    <div>
                      <div style={{ color: 'var(--cp-text-primary)', fontWeight: 600, marginBottom: '4px' }}>Manual profile builder</div>
                      <div style={{ color: 'var(--cp-text-muted)', fontSize: '0.82rem' }}>Fill in your details step by step</div>
                    </div>
                  </div>
                </button>
              </div>
            )}

            {step === 1 && (
              <div>
                <h2 style={{ color: 'var(--cp-text-primary)', fontWeight: 700, fontSize: '1.4rem', marginBottom: '6px' }}>
                  Basic Information ✨
                </h2>
                <p style={{ color: 'var(--cp-text-muted)', fontSize: '0.9rem', marginBottom: '24px' }}>
                  Tell us about yourself {resumeUploaded && <span style={{ color: '#a78bfa' }}>(fields prefilled from resume)</span>}
                </p>
                <div className="space-y-4">
                  <div>
                    <label style={{ color: 'var(--cp-text-muted)', fontSize: '0.8rem', display: 'block', marginBottom: '6px' }}>Email (optional)</label>
                    <input
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      type="email"
                      autoComplete="email"
                      placeholder="you@company.com"
                      className="w-full rounded-xl px-4 py-3 outline-none"
                      style={{
                        background: 'var(--cp-bg-elevated)',
                        border: '1px solid var(--cp-border)',
                        color: 'var(--cp-text-primary)',
                        fontSize: '0.9rem',
                      }}
                    />
                  </div>
                  {[
                    { label: 'Full Name', value: name, setter: setName, placeholder: 'Alex Chen' },
                    { label: 'Current Role', value: currentRole, setter: setCurrentRole, placeholder: 'Frontend Developer' },
                    { label: 'Years of Experience', value: experience, setter: setExperience, placeholder: '3 years' },
                  ].map(field => (
                    <div key={field.label}>
                      <label style={{ color: 'var(--cp-text-muted)', fontSize: '0.8rem', display: 'block', marginBottom: '6px' }}>{field.label}</label>
                      <input
                        value={field.value}
                        onChange={e => field.setter(e.target.value)}
                        placeholder={field.placeholder}
                        className="w-full rounded-xl px-4 py-3 outline-none"
                        style={{
                          background: 'var(--cp-bg-elevated)',
                          border: '1px solid var(--cp-border)',
                          color: 'var(--cp-text-primary)',
                          fontSize: '0.9rem',
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {step === 2 && (
              <div>
                <h2 style={{ color: 'var(--cp-text-primary)', fontWeight: 700, fontSize: '1.4rem', marginBottom: '6px' }}>
                  Your Skills Arsenal 💪
                </h2>
                <p style={{ color: 'var(--cp-text-muted)', fontSize: '0.9rem', marginBottom: '24px' }}>
                  Add your technical and soft skills
                </p>
                <div className="flex gap-2 mb-4">
                  <input
                    value={skillInput}
                    onChange={e => setSkillInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addSkill()}
                    placeholder="React, TypeScript..."
                    className="flex-1 rounded-xl px-4 py-3 outline-none"
                    style={{
                      background: 'var(--cp-bg-elevated)',
                      border: '1px solid var(--cp-border)',
                      color: 'var(--cp-text-primary)',
                      fontSize: '0.9rem',
                    }}
                  />
                  <button type="button" onClick={addSkill} className="btn-primary rounded-xl px-4 py-3">
                    <Plus size={18} />
                  </button>
                </div>
                <div className="flex flex-wrap gap-2 mb-4">
                  {skills.map(skill => (
                    <div key={skill} className="flex items-center gap-2 rounded-xl px-3 py-2"
                      style={{ background: 'rgba(124,58,237,0.2)', border: '1px solid rgba(124,58,237,0.3)' }}>
                      <span style={{ color: '#a78bfa', fontSize: '0.85rem' }}>{skill}</span>
                      <button type="button" onClick={() => removeSkill(skill)} aria-label={`Remove ${skill}`}><X size={12} color="#64748b" /></button>
                    </div>
                  ))}
                  {skills.length === 0 && (
                    <p style={{ color: 'var(--cp-text-faint)', fontSize: '0.85rem' }}>Add your skills above...</p>
                  )}
                </div>
                <div>
                  <p style={{ color: 'var(--cp-text-muted)', fontSize: '0.8rem', marginBottom: '8px' }}>Quick add:</p>
                  <div className="flex flex-wrap gap-2">
                    {['React', 'TypeScript', 'Node.js', 'Python', 'AWS', 'Docker', 'GraphQL', 'SQL'].map(s => (
                      !skills.includes(s) && (
                        <button key={s} type="button" onClick={() => setSkills(prev => [...prev, s])}
                          className="rounded-xl px-3 py-1.5 text-sm"
                          style={{ background: 'var(--cp-bg-card)', border: '1px solid var(--cp-border)', color: 'var(--cp-text-muted)' }}>
                          + {s}
                        </button>
                      )
                    ))}
                  </div>
                </div>
              </div>
            )}

            {step === 3 && (
              <div>
                <h2 style={{ color: 'var(--cp-text-primary)', fontWeight: 700, fontSize: '1.4rem', marginBottom: '6px' }}>
                  Career Goals 🎯
                </h2>
                <p style={{ color: 'var(--cp-text-muted)', fontSize: '0.9rem', marginBottom: '24px' }}>
                  Define where you want to go
                </p>
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label style={{ color: 'var(--cp-text-muted)', fontSize: '0.8rem' }}>Target Role</label>
                      <button
                        type="button"
                        onClick={() => void generateAiRoles()}
                        disabled={aiRoleLoading}
                        className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs transition-all disabled:opacity-50"
                        style={{ background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.3)', color: '#a78bfa' }}
                      >
                        {aiRoleLoading ? '⏳ Loading…' : '✨ AI Suggest'}
                      </button>
                    </div>
                    <input
                      value={targetRole}
                      onChange={e => setTargetRole(e.target.value)}
                      placeholder="Senior Frontend Engineer"
                      className="w-full rounded-xl px-4 py-3 outline-none"
                      style={{ background: 'var(--cp-bg-elevated)', border: '1px solid var(--cp-border)', color: 'var(--cp-text-primary)', fontSize: '0.9rem' }}
                    />
                    {aiRoleSuggestions.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {aiRoleSuggestions.map(r => (
                          <button
                            key={r}
                            type="button"
                            onClick={() => setTargetRole(r)}
                            className="rounded-lg px-3 py-1.5 text-xs transition-all"
                            style={{
                              background: targetRole === r ? 'rgba(124,58,237,0.3)' : 'rgba(255,255,255,0.05)',
                              border: targetRole === r ? '1px solid rgba(124,58,237,0.5)' : '1px solid rgba(255,255,255,0.08)',
                              color: targetRole === r ? '#a78bfa' : '#94a3b8',
                            }}
                          >
                            {r}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label style={{ color: 'var(--cp-text-muted)', fontSize: '0.8rem' }}>Preferred Industry</label>
                      <span style={{ color: industries.length >= 3 ? '#f59e0b' : '#475569', fontSize: '0.72rem' }}>
                        {industries.length}/3 selected
                      </span>
                    </div>
                    <div
                      className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-52 overflow-y-auto pr-1"
                      style={{ scrollbarWidth: 'thin' }}
                    >
                      {PREFERRED_INDUSTRIES.map(ind => {
                        const selected = industries.includes(ind);
                        const maxed = !selected && industries.length >= 3;
                        return (
                          <button
                            key={ind}
                            type="button"
                            disabled={maxed}
                            onClick={() => {
                              if (selected) {
                                setIndustries(prev => prev.filter(i => i !== ind));
                              } else if (!maxed) {
                                setIndustries(prev => [...prev, ind]);
                              }
                            }}
                            className="rounded-xl py-2 px-2 text-center transition-all"
                            style={{
                              background: selected ? 'rgba(124,58,237,0.25)' : 'rgba(255,255,255,0.05)',
                              border: selected ? '1px solid rgba(124,58,237,0.4)' : '1px solid rgba(255,255,255,0.08)',
                              color: selected ? '#a78bfa' : maxed ? '#2d3748' : '#64748b',
                              fontSize: '0.78rem',
                              fontWeight: selected ? 600 : 400,
                              opacity: maxed ? 0.5 : 1,
                              cursor: maxed ? 'not-allowed' : 'pointer',
                            }}
                          >
                            {selected && <span className="mr-1">✓</span>}{ind}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label style={{ color: 'var(--cp-text-muted)', fontSize: '0.8rem' }}>Career Goal</label>
                      <button
                        type="button"
                        onClick={() => void generateAiGoals()}
                        disabled={aiGoalLoading}
                        className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs transition-all disabled:opacity-50"
                        style={{ background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.3)', color: '#a78bfa' }}
                      >
                        {aiGoalLoading ? '⏳ Generating…' : '✨ Generate with AI'}
                      </button>
                    </div>
                    {aiGoalError && (
                      <p className="mb-1 text-xs text-rose-400">{aiGoalError}</p>
                    )}
                    {aiGoalSuggestions.length > 0 && (
                      <div className="flex flex-col gap-1.5 mb-2">
                        {aiGoalSuggestions.map(g => (
                          <button
                            key={g}
                            type="button"
                            onClick={() => setCareerGoal(g)}
                            className="text-left rounded-xl px-3 py-2 text-xs transition-all"
                            style={{
                              background: careerGoal === g ? 'rgba(124,58,237,0.2)' : 'rgba(255,255,255,0.04)',
                              border: careerGoal === g ? '1px solid rgba(124,58,237,0.4)' : '1px solid rgba(255,255,255,0.06)',
                              color: careerGoal === g ? '#a78bfa' : '#94a3b8',
                            }}
                          >
                            {g}
                          </button>
                        ))}
                      </div>
                    )}
                    <textarea
                      value={careerGoal}
                      onChange={e => setCareerGoal(e.target.value)}
                      placeholder="I want to become a senior engineer at a top tech company and lead frontend architecture..."
                      rows={3}
                      className="w-full rounded-xl px-4 py-3 outline-none resize-none"
                      style={{ background: 'var(--cp-bg-elevated)', border: '1px solid var(--cp-border)', color: 'var(--cp-text-primary)', fontSize: '0.9rem' }}
                    />
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        <div className="flex gap-3 mt-6">
          {step > 0 && (
            <button
              type="button"
              onClick={() => {
                setStepError(null);
                setStep(prev => prev - 1);
              }}
              className="flex items-center gap-2 px-4 py-3 rounded-xl"
              style={{ background: 'var(--cp-bg-card)', border: '1px solid var(--cp-border)', color: 'var(--cp-text-muted)' }}
            >
              <ChevronLeft size={18} />
            </button>
          )}
          <motion.button
            type="button"
            onClick={() => void handleNext()}
            disabled={submittingProfile}
            whileTap={submittingProfile ? undefined : { scale: 0.97 }}
            className="btn-primary flex-1 py-3 rounded-xl flex items-center justify-center gap-2 disabled:opacity-60 disabled:pointer-events-none"
            style={{ fontWeight: 600 }}
          >
            {submittingProfile ? (
              <Loader2 className="animate-spin" size={18} aria-hidden />
            ) : null}
            {step === steps.length - 2 ? 'Complete Profile 🚀' : 'Continue'}
            {!submittingProfile && step < steps.length - 2 ? <ChevronRight size={18} /> : null}
          </motion.button>
        </div>

        {step === 0 && (
          <button
            type="button"
            disabled
            style={{ color: 'var(--cp-text-faint)', fontSize: '0.8rem', textAlign: 'center', marginTop: '12px', width: '100%', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            Complete onboarding to continue →
          </button>
        )}
      </div>
    </div>
  );
}
