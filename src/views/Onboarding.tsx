'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import { Upload, ChevronRight, ChevronLeft, Check, Plus, X, FileText, Loader2, AlertTriangle, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { useGame } from '../components/GameContext';
import { CareerDialog } from '../components/CareerDialog';
import { DialogTitle } from '../components/ui/dialog';
import { ResumeUploadButton } from '@/lib/uploadthing/components';
import type { ResumeParseResult } from '@/types/resume-parse-result';
import { mapResumeParsedJsonToOnboardingPrefill } from '@/lib/onboarding/map-resume-parsed-json';
import { normalizeUserInsights } from '@/lib/insights/normalize';
import { parseApiError } from '@/lib/api/client';
import { validateResumeUpload } from '@/lib/resume/validate-upload';
import { STORAGE_KEYS, APP_NAME } from '@/lib/brand';
import { BrandLogo } from '@/components/BrandLogo';
import { useSession } from 'next-auth/react';
import { resolveSalaryLocale } from '@/lib/salary/locale';
import { setRoutingCache } from '@/lib/auth/routing-cache';

const PARSE_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Queued for analysis…',
  PROCESSING: 'Analyzing resume with AI…',
  EXTRACTING: 'Extracting skills & experience…',
  SCORING: 'Generating ATS score…',
  COMPLETE: 'Analysis complete ✓',
  FAILED: 'Analysis failed',
};

/** Read a user-facing message from API error JSON. */
function readApiError(json: unknown, fallback: string): string {
  if (!json || typeof json !== 'object') return fallback;
  const j = json as Record<string, unknown>;
  if (typeof j.message === 'string') return j.message;
  const err = j.error;
  if (err && typeof err === 'object' && typeof (err as { message?: unknown }).message === 'string') {
    return (err as { message: string }).message;
  }
  return fallback;
}

const steps = ['Start', 'Basics', 'Career', 'Goals', 'Done'];
const PASTE_MIN_CHARS = 20;

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
  currentSalary: string;
  salaryType: string;
  salaryCurrency: string;
  salaryGoal: string;
  salaryGoalCurrency: string;
  salaryGoalType: string;
  country: string;
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
  const { data: session, update: updateSession } = useSession();
  const { addXP, xp, level, levelName, isAuthenticated, isOnboarded, isHydrating, refresh, markOnboarded, user } = useGame();
  const resumeXpGranted = useRef(false);
  const redirectTimerRef = useRef<number | null>(null);
  const autosaveSnapshotRef = useRef('');

  const [step, setStep] = useState(0);
  const [resumeUploaded, setResumeUploaded] = useState(false);
  const [resumeParsing, setResumeParsing] = useState(false);
  const [resumeParseStatus, setResumeParseStatus] = useState<string | null>(null);
  const [resumeConfidence, setResumeConfidence] = useState<number | null>(null);
  const [resumeError, setResumeError] = useState<string | null>(null);
  const [showPasteDialog, setShowPasteDialog] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [pasteBusy, setPasteBusy] = useState(false);
  const [pasteError, setPasteError] = useState<string | null>(null);
  const [uploadRetryCount, setUploadRetryCount] = useState(0);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [resumeAnalyzed, setResumeAnalyzed] = useState(false);
  const [activeResumeId, setActiveResumeId] = useState<string | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [pendingUpload, setPendingUpload] = useState<{ ufsUrl: string; key: string; name: string; type: string } | null>(null);
  const [awaitingResumeConfirm, setAwaitingResumeConfirm] = useState(false);
  const [aiPackLoading, setAiPackLoading] = useState(false);

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
  const [currentSalary, setCurrentSalary] = useState('');
  const [salaryType, setSalaryType] = useState('Annual');
  const [salaryCurrency, setSalaryCurrency] = useState('USD');
  const [salaryGoal, setSalaryGoal] = useState('');
  const [salaryGoalCurrency, setSalaryGoalCurrency] = useState('USD');
  const [salaryGoalType, setSalaryGoalType] = useState('Annual');
  const [country, setCountry] = useState('');
  const [stepError, setStepError] = useState<string | null>(null);

  const [showCelebration, setShowCelebration] = useState(false);
  const [draftHydrated, setDraftHydrated] = useState(false);
  const [submittingProfile, setSubmittingProfile] = useState(false);

  const [aiGoalSuggestions, setAiGoalSuggestions] = useState<string[]>([]);
  const [aiGoalError, setAiGoalError] = useState<string | null>(null);
  const [aiRoleSuggestions, setAiRoleSuggestions] = useState<string[]>([]);
  const [aiCourseSuggestions, setAiCourseSuggestions] = useState<string[]>([]);

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
      if (typeof d.currentSalary === 'string') setCurrentSalary(d.currentSalary);
      if (typeof d.salaryType === 'string') setSalaryType(d.salaryType);
      if (typeof d.salaryCurrency === 'string') setSalaryCurrency(d.salaryCurrency);
      if (typeof d.salaryGoal === 'string') setSalaryGoal(d.salaryGoal);
      if (typeof d.salaryGoalCurrency === 'string') setSalaryGoalCurrency(d.salaryGoalCurrency);
      if (typeof d.salaryGoalType === 'string') setSalaryGoalType(d.salaryGoalType);
      if (typeof d.country === 'string') setCountry(d.country);
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
    if (isAuthenticated && isOnboarded && !showCelebration) {
      router.replace('/app/dashboard');
    }
  }, [isAuthenticated, isOnboarded, router, showCelebration]);

  useEffect(() => {
    return () => {
      if (redirectTimerRef.current) {
        window.clearTimeout(redirectTimerRef.current);
      }
    };
  }, []);

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
        currentSalary,
        salaryType,
        salaryCurrency,
        salaryGoal,
        salaryGoalCurrency,
        salaryGoalType,
        country,
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
    currentSalary,
    salaryType,
    salaryCurrency,
    salaryGoal,
    salaryGoalCurrency,
    salaryGoalType,
    country,
  ]);

  useEffect(() => {
    if (!draftHydrated) return;
    setSalaryCurrency(prev => prev || user.salaryCurrency || 'USD');
    setSalaryType(prev => prev || user.salaryFrequency || 'Annual');
    setCurrentSalary(prev => prev.trim() || user.currentSalary || '');
    setSalaryGoal(prev => prev.trim() || user.salaryGoal || '');
    setSalaryGoalCurrency(prev => prev || user.salaryGoalCurrency || user.salaryCurrency || 'USD');
    setSalaryGoalType(prev => prev || user.salaryGoalFrequency || user.salaryFrequency || 'Annual');
  }, [draftHydrated, user.salaryCurrency, user.salaryFrequency, user.salaryGoalCurrency, user.salaryGoalFrequency, user.currentSalary, user.salaryGoal]);

  const salaryLocale = resolveSalaryLocale({
    salaryCurrency,
    salaryFrequency: salaryType,
  });

  const goalSalaryLocale = resolveSalaryLocale({
    salaryCurrency: salaryGoalCurrency,
    salaryFrequency: salaryGoalType,
  });

  useEffect(() => {
    if (!salaryLocale.showMonthlyAndYearly && salaryType !== 'Annual') {
      setSalaryType('Annual');
    }
  }, [salaryLocale.showMonthlyAndYearly, salaryType]);

  useEffect(() => {
    if (!goalSalaryLocale.showMonthlyAndYearly && salaryGoalType !== 'Annual') {
      setSalaryGoalType('Annual');
    }
  }, [goalSalaryLocale.showMonthlyAndYearly, salaryGoalType]);

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

  const loadCachedInsights = useCallback(async (waitForReady = false) => {
    const maxAttempts = waitForReady ? 8 : 1;
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const res = await fetch('/api/v1/insights', { credentials: 'include' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(parseApiError(json, 'Could not load career suggestions.'));
      }
      const normalized = normalizeUserInsights(json?.data);
      if (normalized.recommendedSkills.length || normalized.targetRoles.length) {
        const targetRoles = normalized.targetRoles;
        const careerGoals = normalized.careerGoals;
        const skillsGap = normalized.recommendedSkills;
        const recommendedCourses = normalized.recommendedCourses.map(c => c.title);
        const pathStages = (normalized.careerPath?.stages ?? [])
          .map(s => String(s.title ?? ''))
          .filter(Boolean);

        if (targetRoles[0]) setTargetRole(prev => prev.trim() || targetRoles[0]);
        if (careerGoals[0]) setCareerGoal(prev => prev.trim() || careerGoals[0]);
        setAiRoleSuggestions(Array.from(new Set([...targetRoles, ...pathStages])).slice(0, 6));
        setAiGoalSuggestions(careerGoals.slice(0, 5));
        setAiCourseSuggestions(recommendedCourses.slice(0, 4));

        if (skillsGap.length) {
          setSkills(prev => {
            const merged = [...prev];
            for (const s of skillsGap) {
              if (!merged.some(x => x.toLowerCase() === s.toLowerCase())) merged.push(s);
            }
            return merged;
          });
        }
        return true;
      }
      if (waitForReady) await new Promise(r => setTimeout(r, 1500));
    }
    return false;
  }, []);

  const grantResumeXpOnce = () => {
    if (resumeXpGranted.current) return;
    resumeXpGranted.current = true;
    addXP(100);
  };

  const pollResumeStatus = useCallback(async (resumeId: string): Promise<boolean> => {
    setResumeParseStatus('PROCESSING');
    setUploadProgress(40);
    const startedAt = Date.now();
    while (Date.now() - startedAt < 120_000) {
      try {
        const sRes = await fetch(`/api/v1/resumes/${resumeId}`, { credentials: 'include' });
        const sJson = await sRes.json().catch(() => ({}));
        const status = sJson?.data?.parseStatus as string | undefined;
        if (status) setResumeParseStatus(status);
        if (status === 'PROCESSING' || status === 'PENDING') setUploadProgress(60);
        if (status === 'COMPLETE') {
          setUploadProgress(100);
          setResumeAnalyzed(true);
          const conf = sJson?.data?.confidence as Record<string, unknown> | undefined;
          const overall = typeof conf?.overall === 'number' ? conf.overall : null;
          if (overall != null) setResumeConfidence(overall);
          applyPrefillFromParsedJson(sJson?.data?.parsedJson);
          try {
            await loadCachedInsights(true);
          } catch {
            // non-fatal
          }
          await refresh({ silent: true, force: true });
          return true;
        }
        if (status === 'FAILED') {
          setUploadProgress(0);
          setResumeError((sJson?.data?.parseError as string | undefined) ?? 'Resume parsing failed.');
          return false;
        }
      } catch {
        // keep polling until timeout
      }
      await new Promise(r => setTimeout(r, 2000));
    }
    return false;
  }, [applyPrefillFromParsedJson, loadCachedInsights, refresh]);

  const clearUploadedResume = () => {
    setResumeUploaded(false);
    setResumeAnalyzed(false);
    setActiveResumeId(null);
    setUploadedFileName(null);
    setPendingUpload(null);
    setAwaitingResumeConfirm(false);
    setUploadProgress(0);
    setResumeParseStatus(null);
    setResumeConfidence(null);
    setResumeError(null);
    setResumeParsing(false);
  };

  const runResumePipelineFromUt = async (
    files: { ufsUrl: string; key: string; name: string; type: string }[],
  ) => {
    const file = files[0];
    if (!file?.ufsUrl?.trim() || !file.key) return;

    const validation = validateResumeUpload(file.name, file.type);
    if (!validation.ok) {
      setResumeError(validation.message);
      toast.error('Wrong file uploaded', { description: validation.message });
      return;
    }

    setPendingUpload(file);
    setUploadedFileName(file.name);
    setAwaitingResumeConfirm(true);
    setResumeError(null);
    setResumeParseStatus(null);
    setResumeConfidence(null);
  };

  const confirmResumeUpload = async () => {
    if (!pendingUpload) return;
    const file = pendingUpload;
    setAwaitingResumeConfirm(false);
    setResumeParsing(true);
    setResumeConfidence(null);
    setResumeParseStatus(null);
    setResumeAnalyzed(false);
    setUploadProgress(20);

    try {
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
        throw new Error(readApiError(uploadJson, 'Could not save resume.'));
      }

      if (uploadJson?.data?.skippedParse && uploadJson?.data?.parsedJson) {
        applyPrefillFromParsedJson(uploadJson.data.parsedJson);
      } else {
        const quickRes = await fetch('/api/v1/onboarding/resume/parse', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileUrl: file.ufsUrl,
            fileName: file.name,
            mimeType: file.type || undefined,
          }),
          credentials: 'include',
        });
        const quickJson = await quickRes.json().catch(() => ({}));
        if (quickRes.ok && quickJson?.data) {
          mergeParsed(quickJson.data as ResumeParseResult);
        }
      }

      setUploadProgress(45);
      setResumeUploaded(true);
      setUploadedFileName(file.name);
      grantResumeXpOnce();

      const resumeId = uploadJson?.data?.resumeId as string | undefined;
      if (resumeId) {
        setActiveResumeId(resumeId);
        const ok = await pollResumeStatus(resumeId);
        if (!ok && !resumeAnalyzed) {
          toast.info('Analysis is taking longer than expected. You can continue manually.');
        }
      }

      setStep(1);
      setPendingUpload(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not read that file. Try PDF, DOCX, or TXT.';
      setResumeError(msg);
      setUploadProgress(0);
      toast.error('Resume upload failed.', { description: msg });
      setUploadRetryCount(prev => prev + 1);
    } finally {
      setResumeParsing(false);
    }
  };

  const handlePasteSubmit = async () => {
    const trimmed = pasteText.trim();
    setPasteError(null);

    if (!trimmed) {
      setPasteError('Please paste your resume text first.');
      return;
    }
    if (trimmed.length < PASTE_MIN_CHARS) {
      setPasteError(`Please paste at least ${PASTE_MIN_CHARS} characters of resume text.`);
      return;
    }

    setPasteBusy(true);
    setResumeError(null);
    setResumeConfidence(null);

    try {
      setUploadProgress(20);
      const uploadRes = await fetch('/api/v1/resumes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawText: trimmed }),
        credentials: 'include',
      });
      const uploadJson = await uploadRes.json().catch(() => ({}));
      if (!uploadRes.ok) {
        throw new Error(readApiError(uploadJson, 'Could not save resume.'));
      }
      if (uploadJson?.data?.skippedParse && uploadJson?.data?.parsedJson) {
        applyPrefillFromParsedJson(uploadJson.data.parsedJson);
      } else {
        const parseRes = await fetch('/api/v1/onboarding/resume/parse-text', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: trimmed }),
          credentials: 'include',
        });
        const parseJson = await parseRes.json().catch(() => ({}));
        if (parseRes.ok && parseJson?.data) {
          mergeParsed(parseJson.data as ResumeParseResult);
        }
      }

      setResumeUploaded(true);
      setUploadedFileName('Pasted resume');
      grantResumeXpOnce();
      setShowPasteDialog(false);
      setPasteText('');

      const resumeId = uploadJson?.data?.resumeId as string | undefined;
      if (resumeId) {
        setActiveResumeId(resumeId);
        await pollResumeStatus(resumeId);
      }
      setStep(1);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not parse pasted text.';
      setPasteError(msg);
      toast.error('Failed to import resume text.', { description: msg });
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
      if (currentSalary.trim()) {
        const n = Number(currentSalary.replace(/[^0-9.]/g, ''));
        if (!Number.isFinite(n) || n <= 0) {
          setStepError('Enter a valid current salary or leave it blank.');
          return false;
        }
      }
    }
    return true;
  };

  const generateAiCareerPackage = async () => {
    setAiPackLoading(true);
    setAiGoalError(null);
    try {
      const loaded = await loadCachedInsights(true);
      if (!loaded) {
        throw new Error('Insights are still preparing. Please try again in a few seconds.');
      }
      toast.success('Loaded suggestions from your parsed resume insights');
    } catch {
      setAiGoalError('Could not load suggestions yet. Please retry shortly.');
    } finally {
      setAiPackLoading(false);
    }
  };

  const waitForResumeAnalysis = async (): Promise<boolean> => {
    if (!resumeUploaded || resumeAnalyzed) return true;
    if (!activeResumeId) return true;
    return pollResumeStatus(activeResumeId);
  };

  useEffect(() => {
    if (!draftHydrated || !isAuthenticated || submittingProfile) return;
    if (step < 2) return;

    const payload = {
      skills: skills.length > 0 ? skills : undefined,
      careerGoal: careerGoal.trim() || undefined,
      targetRole: targetRole.trim() || undefined,
      preferredIndustry: industries[0]?.trim() || industry.trim() || undefined,
      preferredIndustries: industries.length > 0 ? industries : undefined,
      currentSalary: currentSalary.trim() || undefined,
      salaryCurrency: salaryCurrency || undefined,
      salaryFrequency: salaryType || undefined,
      salaryExpectation: salaryGoal.trim() || undefined,
      salaryGoalCurrency: salaryGoalCurrency || undefined,
      salaryGoalFrequency: salaryGoalType || undefined,
    };
    const snapshot = JSON.stringify(payload);
    if (snapshot === autosaveSnapshotRef.current) return;

    const t = window.setTimeout(() => {
      void fetch('/api/v1/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: snapshot,
        credentials: 'include',
      }).then(async res => {
        if (!res.ok) return;
        autosaveSnapshotRef.current = snapshot;
        // Autosave should not force a full app re-hydration; local onboarding state is source of truth.
      }).catch(() => {
        // silent autosave retry on next change
      });
    }, 700);
    return () => window.clearTimeout(t);
  }, [
    draftHydrated,
    isAuthenticated,
    submittingProfile,
    step,
    skills,
    careerGoal,
    targetRole,
    industries,
    industry,
    currentSalary,
    salaryCurrency,
    salaryType,
    salaryGoal,
    salaryGoalCurrency,
    salaryGoalType,
    refresh,
  ]);

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
      if (resumeUploaded && !resumeAnalyzed) {
        setResumeParseStatus('PROCESSING');
        const ready = await waitForResumeAnalysis();
        if (!ready) {
          throw new Error('Resume analysis is still in progress. Please wait or continue with manual profile.');
        }
      }

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
          currentSalary: currentSalary.trim() || undefined,
          salaryCurrency: salaryCurrency || undefined,
          salaryFrequency: salaryType || undefined,
          salaryExpectation: salaryGoal.trim() || undefined,
          salaryGoalCurrency: salaryGoalCurrency || undefined,
          salaryGoalFrequency: salaryGoalType || undefined,
          bio: profileSummary.trim() || undefined,
          onboardingComplete: true,
        }),
        credentials: 'include',
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(readApiError(json, 'Profile update failed'));
      }

      await updateSession({ onboardingComplete: true });
      markOnboarded();
      if (session?.user?.id) {
        setRoutingCache(session.user.id, {
          authenticated: true,
          registered: true,
          onboardingComplete: true,
          subscriptionTier: user.subscriptionTier,
        });
      }
      void refresh({ silent: true, force: true });

      try {
        localStorage.removeItem(DRAFT_KEY);
        localStorage.removeItem(DRAFT_KEY_LEGACY);
        if (session?.user?.id) {
          localStorage.setItem(STORAGE_KEYS.onboardingCache(session.user.id), '1');
        }
      } catch {
        // ignore
      }

      addXP(500, { actionKey: `onboarding-complete:${session?.user?.id ?? 'user'}`, actionType: 'ONBOARDING_COMPLETE' });
      setShowCelebration(true);
      redirectTimerRef.current = window.setTimeout(() => {
        window.location.replace('/app/dashboard');
      }, 900);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Profile update failed. Please try again.';
      setResumeError(msg);
      toast.error('Profile update failed.', { description: msg });
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
      <CareerDialog open={showPasteDialog} onOpenChange={open => {
        setShowPasteDialog(open);
        if (!open) { setPasteText(''); setPasteError(null); }
      }}>
        <DialogTitle className="sr-only">Paste resume text</DialogTitle>
        <p style={{ color: 'var(--cp-text-muted)', fontSize: '0.85rem', marginBottom: '12px' }}>
          Paste your resume as plain text. AI will extract your name, skills, and experience.
        </p>
        <div className="relative mb-1">
          <textarea
            value={pasteText}
            onChange={e => { setPasteText(e.target.value); if (pasteError) setPasteError(null); }}
            rows={8}
            className="w-full resize-none rounded-xl px-4 py-3 outline-none"
            style={{
              background: 'var(--cp-bg-elevated)',
              border: pasteError ? '1px solid rgba(244,63,94,0.5)' : '1px solid var(--cp-border)',
              color: 'var(--cp-text-primary)',
              fontSize: '0.9rem',
            }}
            placeholder="Paste resume text here… (minimum 20 characters)"
            disabled={pasteBusy}
          />
        </div>
        <div className="flex items-center justify-between mb-3" style={{ fontSize: '0.75rem' }}>
          <span style={{ color: pasteText.trim().length < PASTE_MIN_CHARS && pasteText.length > 0 ? '#f87171' : 'var(--cp-text-faint)' }}>
            {pasteText.trim().length} / {PASTE_MIN_CHARS} characters minimum
          </span>
          {pasteText.trim().length >= PASTE_MIN_CHARS && (
            <span style={{ color: '#10b981' }}>✓ Ready to import</span>
          )}
        </div>
        {pasteError && (
          <div className="flex items-start gap-2 mb-3 rounded-xl px-3 py-2"
            style={{ background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.3)' }}>
            <AlertTriangle size={14} color="#f87171" className="mt-0.5 shrink-0" />
            <p style={{ color: '#fda4af', fontSize: '0.82rem' }}>{pasteError}</p>
          </div>
        )}
        <div className="flex gap-2">
          <button
            type="button"
            className="flex-1 rounded-xl py-3"
            style={{ background: 'var(--cp-bg-elevated)', border: '1px solid var(--cp-border)', color: 'var(--cp-text-muted)' }}
            onClick={() => { setShowPasteDialog(false); setPasteText(''); setPasteError(null); }}
            disabled={pasteBusy}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary flex-1 flex items-center justify-center gap-2 rounded-xl py-3"
            disabled={pasteBusy || pasteText.trim().length < PASTE_MIN_CHARS}
            onClick={() => void handlePasteSubmit()}
          >
            {pasteBusy ? <Loader2 className="animate-spin" size={18} /> : null}
            {pasteBusy ? 'Importing…' : 'Import Resume'}
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

                {(resumeParsing || uploadProgress > 0) && (
                  <div className="mb-4">
                    <div className="flex justify-between mb-1">
                      <span style={{ color: 'var(--cp-text-muted)', fontSize: '0.78rem' }}>
                        {uploadProgress < 40 ? 'Uploading resume…' : uploadProgress < 60 ? 'Parsing…' : uploadProgress < 100 ? 'AI analysis…' : 'Complete ✓'}
                      </span>
                      <span style={{ color: '#a78bfa', fontSize: '0.78rem', fontWeight: 600 }}>{uploadProgress}%</span>
                    </div>
                    <div className="rounded-full overflow-hidden" style={{ background: 'var(--cp-bg-elevated)', height: '6px' }}>
                      <div className="xp-bar h-full rounded-full transition-all duration-500" style={{ width: `${uploadProgress}%` }} />
                    </div>
                  </div>
                )}

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
                      {resumeParseStatus && resumeParseStatus !== 'COMPLETE' ? (
                        <div className="flex items-center gap-1.5 mt-1.5">
                          {resumeParseStatus !== 'FAILED' && <Loader2 size={12} className="animate-spin text-violet-400" />}
                          <span style={{ color: resumeParseStatus === 'FAILED' ? '#f87171' : 'var(--cp-text-muted)', fontSize: '0.78rem' }}>
                            {PARSE_STATUS_LABELS[resumeParseStatus] ?? resumeParseStatus}
                          </span>
                        </div>
                      ) : null}
                      {resumeConfidence != null ? (
                        <div style={{ color: '#10b981', fontSize: '0.78rem', fontWeight: 700, marginTop: '4px' }}>
                          AI confidence: {Math.round(resumeConfidence * 100)}%
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
                      {awaitingResumeConfirm && uploadedFileName && !resumeUploaded && (
                        <div className="mt-3 rounded-xl p-3 space-y-3" style={{ background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.25)' }}>
                          <p style={{ color: 'var(--cp-text-primary)', fontSize: '0.82rem', fontWeight: 600 }}>
                            Use this resume for profile completion?
                          </p>
                          <p style={{ color: 'var(--cp-text-muted)', fontSize: '0.78rem' }}>{uploadedFileName}</p>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => void confirmResumeUpload()}
                              disabled={resumeParsing}
                              className="flex-1 rounded-xl py-2 text-sm font-semibold btn-primary disabled:opacity-60"
                            >
                              {resumeParsing ? 'Parsing…' : 'Yes, parse resume'}
                            </button>
                            <button
                              type="button"
                              onClick={clearUploadedResume}
                              disabled={resumeParsing}
                              className="flex-1 rounded-xl py-2 text-sm font-semibold disabled:opacity-60"
                              style={{ background: 'var(--cp-bg-card)', border: '1px solid var(--cp-border)', color: 'var(--cp-text-muted)' }}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                      {resumeUploaded && uploadedFileName && (
                        <div className="mt-2 flex items-center gap-2 flex-wrap">
                          <span style={{ color: 'var(--cp-text-muted)', fontSize: '0.78rem' }}>{uploadedFileName}</span>
                          {!resumeParsing && (
                            <button
                              type="button"
                              className="text-xs rounded-lg px-2 py-1"
                              style={{ background: 'rgba(244,63,94,0.12)', color: '#fda4af', border: '1px solid rgba(244,63,94,0.3)' }}
                              onClick={clearUploadedResume}
                            >
                              Remove & re-upload
                            </button>
                          )}
                        </div>
                      )}
                      {!resumeUploaded && !awaitingResumeConfirm && !resumeParsing && (
                        <div className="mt-3 max-w-xs" onClick={e => e.stopPropagation()}>
                          <ResumeUploadButton
                            endpoint="resume"
                            disabled={resumeParsing || awaitingResumeConfirm}
                            onClientUploadComplete={res => void runResumePipelineFromUt(res)}
                            onUploadError={e => setResumeError(e.message)}
                            appearance={{
                              button: 'bg-violet-600 hover:bg-violet-500 border-0 text-white rounded-xl px-4 py-2 text-sm font-semibold w-full disabled:opacity-50',
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
                  <div className="mb-4 rounded-xl px-3 py-3"
                    style={{ background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.3)' }}
                    role="alert"
                  >
                    <div className="flex items-start gap-2 mb-2">
                      <AlertTriangle size={14} color="#f87171" className="mt-0.5 shrink-0" />
                      <p style={{ color: '#fda4af', fontSize: '0.82rem' }}>{resumeError}</p>
                    </div>
                    {uploadRetryCount < 2 && !resumeUploaded && (
                      <button
                        type="button"
                        className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs"
                        style={{ background: 'rgba(244,63,94,0.15)', border: '1px solid rgba(244,63,94,0.3)', color: '#fda4af' }}
                        onClick={() => { setResumeError(null); setResumeParseStatus(null); }}
                      >
                        <RotateCcw size={11} /> Try again
                      </button>
                    )}
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="glass-card w-full rounded-3xl p-5 text-left transition-all"
                  style={{
                    border: resumeError ? '1px solid rgba(124,58,237,0.45)' : '1px solid var(--cp-border)',
                    background: resumeError ? 'rgba(124,58,237,0.08)' : undefined,
                  }}
                >
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
                      style={{ background: resumeError ? 'rgba(124,58,237,0.2)' : 'var(--cp-bg-card)' }}>
                      <span style={{ fontSize: '1.4rem' }}>📝</span>
                    </div>
                    <div>
                      <div style={{ color: 'var(--cp-text-primary)', fontWeight: 600, marginBottom: '4px' }}>
                        Manual profile builder
                        {resumeError && <span style={{ color: '#a78bfa', fontSize: '0.75rem', marginLeft: '8px' }}>← Recommended</span>}
                      </div>
                      <div style={{ color: 'var(--cp-text-muted)', fontSize: '0.82rem' }}>
                        {resumeError ? "Fill in your details step by step — no file needed." : "Fill in your details step by step"}
                      </div>
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
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => void generateAiCareerPackage()}
                      disabled={aiPackLoading}
                      className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs transition-all disabled:opacity-50"
                      style={{ background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.3)', color: '#a78bfa' }}
                    >
                      {aiPackLoading ? '⏳ Loading…' : '✨ Load Suggestions'}
                    </button>
                  </div>
                  <div>
                    <label style={{ color: 'var(--cp-text-muted)', fontSize: '0.8rem', display: 'block', marginBottom: '6px' }}>Target Role</label>
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
                  <div className="rounded-2xl p-3" style={{ background: 'var(--cp-surface-1)', border: '1px solid var(--cp-border-subtle)' }}>
                    <p style={{ color: 'var(--cp-text-primary)', fontSize: '0.85rem', fontWeight: 600, marginBottom: '8px' }}>
                      Current Salary
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div>
                        <label style={{ color: 'var(--cp-text-muted)', fontSize: '0.72rem', display: 'block', marginBottom: '6px' }}>
                          Salary
                        </label>
                        <input
                          value={currentSalary}
                          onChange={e => setCurrentSalary(e.target.value)}
                          placeholder={salaryCurrency === 'INR' ? '1200000' : '95000'}
                          className="w-full rounded-xl px-3 py-2 outline-none"
                          style={{ background: 'var(--cp-bg-elevated)', border: '1px solid var(--cp-border)', color: 'var(--cp-text-primary)', fontSize: '0.84rem' }}
                        />
                      </div>
                      <div>
                        <label style={{ color: 'var(--cp-text-muted)', fontSize: '0.72rem', display: 'block', marginBottom: '6px' }}>
                          Currency
                        </label>
                        <select
                          value={salaryCurrency}
                          onChange={e => setSalaryCurrency(e.target.value)}
                          className="w-full rounded-xl px-3 py-2 outline-none"
                          style={{ background: 'var(--cp-bg-elevated)', border: '1px solid var(--cp-border)', color: 'var(--cp-text-primary)', fontSize: '0.84rem' }}
                        >
                          {['USD', 'INR', 'EUR', 'GBP'].map(c => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label style={{ color: 'var(--cp-text-muted)', fontSize: '0.72rem', display: 'block', marginBottom: '6px' }}>
                          Salary Type
                        </label>
                        <select
                          value={salaryType}
                          onChange={e => setSalaryType(e.target.value)}
                          className="w-full rounded-xl px-3 py-2 outline-none"
                          style={{ background: 'var(--cp-bg-elevated)', border: '1px solid var(--cp-border)', color: 'var(--cp-text-primary)', fontSize: '0.84rem' }}
                        >
                          {salaryLocale.showMonthlyAndYearly ? (
                            <>
                              <option value="Monthly">Monthly</option>
                              <option value="Annual">Annual</option>
                            </>
                          ) : (
                            <option value="Annual">Annual</option>
                          )}
                        </select>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-2xl p-3" style={{ background: 'var(--cp-surface-1)', border: '1px solid var(--cp-border-subtle)' }}>
                    <p style={{ color: 'var(--cp-text-primary)', fontSize: '0.85rem', fontWeight: 600, marginBottom: '8px' }}>
                      Expected Salary Goal
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div>
                        <label style={{ color: 'var(--cp-text-muted)', fontSize: '0.72rem', display: 'block', marginBottom: '6px' }}>
                          Expected Salary
                        </label>
                        <input
                          value={salaryGoal}
                          onChange={e => setSalaryGoal(e.target.value)}
                          placeholder={salaryGoalCurrency === 'INR' ? '1800000' : '120000'}
                          className="w-full rounded-xl px-3 py-2 outline-none"
                          style={{ background: 'var(--cp-bg-elevated)', border: '1px solid var(--cp-border)', color: 'var(--cp-text-primary)', fontSize: '0.84rem' }}
                        />
                      </div>
                      <div>
                        <label style={{ color: 'var(--cp-text-muted)', fontSize: '0.72rem', display: 'block', marginBottom: '6px' }}>
                          Currency
                        </label>
                        <select
                          value={salaryGoalCurrency}
                          onChange={e => setSalaryGoalCurrency(e.target.value)}
                          className="w-full rounded-xl px-3 py-2 outline-none"
                          style={{ background: 'var(--cp-bg-elevated)', border: '1px solid var(--cp-border)', color: 'var(--cp-text-primary)', fontSize: '0.84rem' }}
                        >
                          {['USD', 'INR', 'EUR', 'GBP'].map(c => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label style={{ color: 'var(--cp-text-muted)', fontSize: '0.72rem', display: 'block', marginBottom: '6px' }}>
                          Salary Type
                        </label>
                        <select
                          value={salaryGoalType}
                          onChange={e => setSalaryGoalType(e.target.value)}
                          className="w-full rounded-xl px-3 py-2 outline-none"
                          style={{ background: 'var(--cp-bg-elevated)', border: '1px solid var(--cp-border)', color: 'var(--cp-text-primary)', fontSize: '0.84rem' }}
                        >
                          {goalSalaryLocale.showMonthlyAndYearly ? (
                            <>
                              <option value="Monthly">Monthly</option>
                              <option value="Annual">Annual</option>
                            </>
                          ) : (
                            <option value="Annual">Annual</option>
                          )}
                        </select>
                      </div>
                    </div>
                  </div>
                  <div>
                    <label style={{ color: 'var(--cp-text-muted)', fontSize: '0.8rem', display: 'block', marginBottom: '6px' }}>Career Goal</label>
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
                    {aiCourseSuggestions.length > 0 && (
                      <div className="rounded-xl px-3 py-2 mb-2" style={{ background: 'rgba(6,182,212,0.08)', border: '1px solid rgba(6,182,212,0.2)' }}>
                        <p style={{ color: '#67e8f9', fontSize: '0.7rem', fontWeight: 600, marginBottom: '6px' }}>Recommended Courses</p>
                        <div className="flex flex-wrap gap-1.5">
                          {aiCourseSuggestions.map(c => (
                            <span key={c} className="rounded-lg px-2 py-1" style={{ background: 'rgba(6,182,212,0.14)', color: '#22d3ee', fontSize: '0.68rem' }}>
                              {c}
                            </span>
                          ))}
                        </div>
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
