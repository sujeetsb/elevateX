'use client';

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Upload,
  Zap,
  AlertCircle,
  ChevronRight,
  TrendingUp,
  ArrowLeft,
  Sparkles,
  FileDown,
  Monitor,
  Smartphone,
  Pencil,
  Bot,
  Loader2,
} from 'lucide-react';
import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer } from 'recharts';
import { useGame } from '../components/GameContext';
import { useRouter } from 'next/navigation';
import type { AISuggestion, OptimizeMode, ResumeDocument, ResumeTemplateId, WizardStep } from '../lib/resume/types';
import { buildInitialResumeFromProfile, generateSuggestions, applyOptimizeMode } from '../lib/resume/mockAi';
import { saveResumeToLibrary, appendOptimizationHistory } from '../lib/resume/storage';
import { ResumePreview } from '../components/resume-builder/ResumePreview';
import { TemplateGallery } from '../components/resume-builder/TemplateGallery';
import { AISuggestionsPanel } from '../components/resume-builder/AISuggestionsPanel';
import { ResumeEditor } from '../components/resume-builder/ResumeEditor';
import { ResumeUploadButton } from '@/lib/uploadthing/components';
import { useUploadThing } from '@/lib/uploadthing/react-helpers';
import {
  normalizeUploadThingFile,
  pollResumeUntilComplete,
  postResumeFromRawText,
  postResumeFromUploadThingParts,
  RESUME_ACCEPT,
  validateLocalResumeFile,
} from '@/lib/resume/resume-client-pipeline';
import { mapResumeParsedJsonToOnboardingPrefill } from '@/lib/onboarding/map-resume-parsed-json';

const DEFAULT_ATS_CATEGORIES = [
  { name: 'Keywords',   score: 65, max: 100, color: '#7c3aed', tip: 'Upload or paste your resume to get personalized keyword analysis.' },
  { name: 'Formatting', score: 70, max: 100, color: '#10b981', tip: 'Run ATS analysis to check formatting compatibility.' },
  { name: 'Experience', score: 60, max: 100, color: '#06b6d4', tip: 'Run analysis to see how your experience section scores.' },
  { name: 'Skills',     score: 55, max: 100, color: '#a78bfa', tip: 'Upload your resume to get skill gap analysis.' },
  { name: 'Education',  score: 70, max: 100, color: '#f59e0b', tip: 'Run analysis to evaluate your education section.' },
  { name: 'Impact',     score: 50, max: 100, color: '#f43f5e', tip: 'Add quantified achievements to improve your impact score.' },
];

const DEFAULT_IMPROVEMENTS = [
  { priority: 'high',   text: 'Upload your resume to get AI-powered, personalized ATS insights.', impact: 'Unlock analysis', icon: '🤖' },
  { priority: 'high',   text: 'Add quantified achievements with numbers and metrics.',             impact: '+8–12 pts',      icon: '📊' },
  { priority: 'medium', text: 'Include a 3-line professional summary aligned to your target role.', impact: '+6–10 pts',   icon: '📝' },
  { priority: 'medium', text: 'Incorporate role-specific keywords from job descriptions.',          impact: '+5–8 pts',     icon: '🔑' },
  { priority: 'low',    text: 'Standardize date formats and formatting consistency.',               impact: '+2–4 pts',     icon: '📅' },
];

const PRIORITY_ICONS: Record<string, string> = {
  critical: '🚨', high: '⚠️', medium: '💡', low: '📌',
};

const priorityColors: Record<string, string> = {
  critical: '#f43f5e', high: '#f59e0b', medium: '#06b6d4', low: '#64748b',
};

type AtsCategoryItem = { name: string; score: number; max: number; color: string; tip: string };
type ImprovementItem = { priority: string; text: string; impact: string; icon: string };

/** Derive ATS category display from AI-parsed resume intelligence. */
function buildAtsCategoriesFromParsed(parsed: Record<string, unknown> | null): AtsCategoryItem[] {
  if (!parsed) return DEFAULT_ATS_CATEGORIES;

  const sections = (parsed.analyzerReport as Record<string, unknown> | undefined)?.sections as Record<string, { score?: number; comment?: string }> | undefined;
  const deepSections = (parsed.atsDeepAnalysis as Record<string, unknown> | undefined)?.sections as Record<string, { score?: number; comment?: string }> | undefined;

  function pick(key: string, fallback: number): number {
    const v = deepSections?.[key]?.score ?? sections?.[key]?.score;
    return typeof v === 'number' ? Math.min(100, Math.max(0, Math.round(v))) : fallback;
  }
  function tip(key: string, def: string): string {
    return (deepSections?.[key] as { comment?: string } | undefined)?.comment ??
           (sections?.[key] as { comment?: string } | undefined)?.comment ?? def;
  }

  return [
    { name: 'Keywords',   score: pick('keywords', 65),   max: 100, color: '#7c3aed', tip: tip('keywords', 'Add role-specific keywords from job descriptions.') },
    { name: 'Formatting', score: pick('formatting', 72), max: 100, color: '#10b981', tip: tip('formatting', 'Use clean single-column formatting for ATS compatibility.') },
    { name: 'Experience', score: pick('experience', 68), max: 100, color: '#06b6d4', tip: tip('experience', 'Strengthen bullet points with action verbs and metrics.') },
    { name: 'Skills',     score: pick('skills', 60),     max: 100, color: '#a78bfa', tip: tip('skills', 'List technical and domain skills relevant to your target role.') },
    { name: 'Education',  score: pick('education', 70),  max: 100, color: '#f59e0b', tip: tip('education', 'Include your degree, institution, and graduation year.') },
    { name: 'Impact',     score: pick('impact', 55),     max: 100, color: '#f43f5e', tip: tip('impact', 'Add metrics: percentages, dollar amounts, or timeframes.') },
  ];
}

/** Derive improvement list from AI analysis data. */
function buildImprovementsFromParsed(parsed: Record<string, unknown> | null): ImprovementItem[] {
  if (!parsed) return DEFAULT_IMPROVEMENTS;

  const topImprovements = ((parsed.atsDeepAnalysis as Record<string, unknown> | undefined)?.topImprovements ?? []) as Array<{ priority?: string; action?: string; expectedImpact?: string }>;
  const tips = ((parsed.analyzerReport as Record<string, unknown> | undefined)?.tips_for_improvement ?? []) as string[];
  const gaps = (parsed.gaps ?? []) as string[];

  const items: ImprovementItem[] = [];

  for (const imp of topImprovements.slice(0, 6)) {
    if (!imp.action?.trim()) continue;
    items.push({
      priority: imp.priority ?? 'medium',
      text: imp.action.trim(),
      impact: imp.expectedImpact?.trim() ? `+${imp.expectedImpact.trim().replace(/^\+/, '')}` : '+pts',
      icon: PRIORITY_ICONS[imp.priority ?? 'medium'] ?? '💡',
    });
  }

  if (items.length < 4) {
    for (const tip of tips.slice(0, 4 - items.length)) {
      if (!tip?.trim()) continue;
      items.push({ priority: 'medium', text: tip.trim(), impact: '+pts', icon: '💡' });
    }
  }

  if (items.length < 4) {
    for (const gap of gaps.slice(0, 4 - items.length)) {
      if (!gap?.trim()) continue;
      items.push({ priority: 'medium', text: `Close skill gap: ${gap.trim()}`, impact: '+pts', icon: '🎯' });
    }
  }

  return items.length >= 2 ? items : DEFAULT_IMPROVEMENTS;
}

function resumeStudioChipIndex(step: WizardStep): number {
  switch (step) {
    case 'ats':
      return 0;
    case 'improvements':
      return 1;
    case 'template':
      return 2;
    case 'optimize-mode':
    case 'ai-processing':
      return 3;
    case 'editor':
      return 4;
    default:
      return 0;
  }
}

function rid() {
  return typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `r-${Date.now()}`;
}

function ScoreGauge({ score }: { score: number }) {
  const r = 56;
  const circ = Math.PI * r;
  const dash = (score / 100) * circ;
  const color = score >= 80 ? '#10b981' : score >= 60 ? '#f59e0b' : '#f43f5e';

  return (
    <div className="relative flex items-center justify-center" style={{ width: '160px', height: '100px' }}>
      <svg width="160" height="100" viewBox="0 0 160 100">
        <path d="M 10 90 A 70 70 0 0 1 150 90" fill="none" stroke="var(--cp-border)" strokeWidth="12" strokeLinecap="round" />
        <motion.path
          d="M 10 90 A 70 70 0 0 1 150 90"
          fill="none"
          stroke={color}
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={`${circ} ${circ}`}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: circ - dash }}
          transition={{ duration: 2, ease: 'easeOut' }}
          style={{ filter: `drop-shadow(0 0 8px ${color}80)` }}
        />
      </svg>
      <div className="absolute bottom-1 text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5, duration: 0.5 }}
          style={{ color, fontWeight: 800, fontSize: '2rem', lineHeight: 1 }}
        >
          {score}
        </motion.div>
        <div style={{ color: 'var(--cp-text-muted)', fontSize: '0.72rem' }}>ATS Score</div>
      </div>
    </div>
  );
}

function buildSyntheticResumeText(
  u: { name: string; email: string; currentRole: string; experience: string; skills: string[]; education: string; bio: string; careerGoal: string; targetRole: string },
  targetRole: string,
): string {
  return [
    u.name,
    u.email,
    u.currentRole || targetRole,
    u.experience,
    u.education,
    u.bio,
    u.careerGoal,
    ...(u.skills ?? []),
  ]
    .filter(x => typeof x === 'string' && x.trim())
    .join('\n')
    .slice(0, 100_000);
}

export function ATSOptimizer() {
  const router = useRouter();
  const { user, atsScore, setAtsScore, addXP, updateProfile, refresh } = useGame();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingResumeIdRef = useRef<string | null>(null);

  const [ingestError, setIngestError] = useState<string | null>(null);
  const [ingestPhase, setIngestPhase] = useState<'idle' | 'uploading' | 'parsing'>('idle');
  const [dragActive, setDragActive] = useState(false);
  const [hasPendingUploadedResume, setHasPendingUploadedResume] = useState(false);
  const [analyzeBusy, setAnalyzeBusy] = useState(false);
  const [autoLoadedResume, setAutoLoadedResume] = useState<{ id: string; title: string } | null>(null);
  const [autoLoadError, setAutoLoadError] = useState<string | null>(null);

  // Auto-load latest resume from DB on mount
  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch('/api/v1/resumes', { credentials: 'include' });
        if (!res.ok) return;
        const json = await res.json();
        const resumes = Array.isArray(json?.data) ? json.data : [];
        const latest = resumes.find(
          (r: { parseStatus?: string; parsedJson?: unknown }) => r.parseStatus === 'COMPLETE' && r.parsedJson,
        ) as { id: string; title: string; parsedJson: Record<string, unknown> } | undefined;
        if (!latest) return;

        const parsed = latest.parsedJson as Record<string, unknown>;
        pendingResumeIdRef.current = latest.id;
        setHasPendingUploadedResume(true);
        setAutoLoadedResume({ id: latest.id, title: latest.title ?? 'Resume' });

        const cats = buildAtsCategoriesFromParsed(parsed);
        setParsedIntelligence(parsed);

        // Auto-generate suggestions from parsed resume
        const prefill = mapResumeParsedJsonToOnboardingPrefill(parsed);
        if (prefill.summary?.trim()) {
          setResumeText(prev => (prev.trim() ? prev : prefill.summary!.trim()));
        }

        const suggestionList = generateSuggestions(
          buildInitialResumeFromProfile({ ...user, certifications: user.certifications.map(c => c.name) }),
        );
        setSuggestions(suggestionList);

        // Show ATS data without re-upload
        if (cats.length) {
          setWizardStep('ats');
        }
      } catch {
        setAutoLoadError('Could not auto-load your resume.');
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [wizardStep, setWizardStep] = useState<WizardStep>('upload');
  const [tab, setTab] = useState<'score' | 'improve' | 'radar'>('score');
  const [resumeText, setResumeText] = useState('');
  const [targetRoleDraft, setTargetRoleDraft] = useState(user.targetRole || 'Senior Software Engineer');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [parsedIntelligence, setParsedIntelligence] = useState<Record<string, unknown> | null>(null);

  const [resumeDoc, setResumeDoc] = useState<ResumeDocument | null>(null);
  const [templateId, setTemplateId] = useState<ResumeTemplateId>('modern-saas');
  const [suggestions, setSuggestions] = useState<AISuggestion[]>([]);
  const [optimizeMode, setOptimizeMode] = useState<OptimizeMode | null>(null);
  const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>('desktop');
  const [mobileStudioTab, setMobileStudioTab] = useState<'edit' | 'preview' | 'ai'>('edit');
  const [scoreBeforeStudio, setScoreBeforeStudio] = useState<number | null>(null);

  const handleUtFilesComplete = useCallback(async (res: unknown[]) => {
    const file = Array.isArray(res) ? res[0] : null;
    const parts = normalizeUploadThingFile(file);
    if (!parts) {
      setIngestError('Upload completed but file metadata was missing.');
      setIngestPhase('idle');
      return;
    }
    setIngestError(null);
    setIngestPhase('parsing');
    const posted = await postResumeFromUploadThingParts(parts);
    if (!posted.ok) {
      setIngestError(posted.message);
      setIngestPhase('idle');
      return;
    }
    pendingResumeIdRef.current = posted.resumeId;
    setHasPendingUploadedResume(true);
    const pre = mapResumeParsedJsonToOnboardingPrefill(posted.prefill);
    if (pre.summary?.trim()) {
      setResumeText(prev => (prev.trim() ? prev : pre.summary!.trim()));
    }
    setIngestPhase('idle');
  }, []);

  const { startUpload, isUploading } = useUploadThing('resume', {
    onClientUploadComplete: handleUtFilesComplete,
    onUploadError: e => {
      setIngestError(e.message);
      setIngestPhase('idle');
    },
  });

  const highlightPaths = useMemo(() => {
    const s = new Set<string>();
    suggestions.forEach(x => {
      if (x.status === 'pending' && x.targetPath) s.add(x.targetPath);
    });
    return s;
  }, [suggestions]);

  const goBack = useCallback(() => {
    const prev: Partial<Record<WizardStep, WizardStep>> = {
      ats: 'upload',
      improvements: 'ats',
      template: 'improvements',
      'optimize-mode': 'template',
      'ai-processing': 'optimize-mode',
      editor: 'optimize-mode',
    };
    const p = prev[wizardStep];
    if (p) setWizardStep(p);
  }, [wizardStep]);

  const handleAnalyze = useCallback(async () => {
    setIngestError(null);
    setAnalyzeBusy(true);
    setWizardStep('analyzing');
    try {
      let resumeId = pendingResumeIdRef.current;

      if (!resumeId) {
        const trimmed = resumeText.trim();
        if (trimmed.length >= 20) {
          try {
            const parseRes = await fetch('/api/v1/onboarding/resume/parse-text', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ text: trimmed }),
              credentials: 'include',
            });
            const parseJson = await parseRes.json().catch(() => ({}));
            if (parseRes.ok && parseJson?.data) {
              const pre = mapResumeParsedJsonToOnboardingPrefill(parseJson.data);
              updateProfile({
                ...(pre.currentRole ? { currentRole: pre.currentRole } : {}),
                ...(pre.targetRole ? { targetRole: pre.targetRole } : {}),
                ...(pre.experience ? { experience: pre.experience } : {}),
                ...(pre.skills?.length ? { skills: pre.skills } : {}),
                ...(pre.summary ? { bio: pre.summary } : {}),
                ...(pre.careerGoal ? { careerGoal: pre.careerGoal } : {}),
                ...(pre.education ? { education: pre.education } : {}),
                ...(pre.linkedIn ? { linkedIn: pre.linkedIn } : {}),
              });
            }
          } catch {
            // optional client pre-parse
          }
          const posted = await postResumeFromRawText(trimmed, 'ATS — pasted resume');
          if (!posted.ok) throw new Error(posted.message);
          resumeId = posted.resumeId;
        } else {
          const synthetic = buildSyntheticResumeText(user, targetRoleDraft.trim() || user.targetRole);
          if (synthetic.trim().length < 20) {
            throw new Error('Add resume text (20+ characters), upload a file, or complete your profile first.');
          }
          const posted = await postResumeFromRawText(synthetic, 'ATS — profile snapshot');
          if (!posted.ok) throw new Error(posted.message);
          resumeId = posted.resumeId;
        }
      }

      if (!resumeId) throw new Error('No resume to analyze. Upload a file or paste resume text.');

      setIngestPhase('parsing');
      const polled = await pollResumeUntilComplete(resumeId, {
        timeoutMs: 120_000,
        onStatus: st => {
          if (st === 'PENDING' || st === 'PROCESSING') setIngestPhase('parsing');
        },
      });
      if (!polled.ok) throw new Error(polled.message);
      setIngestPhase('idle');

      if (polled.parsedJson && typeof polled.parsedJson === 'object') {
        setParsedIntelligence(polled.parsedJson as Record<string, unknown>);
      }

      const pre = mapResumeParsedJsonToOnboardingPrefill(polled.parsedJson);
      const roleTarget = targetRoleDraft.trim() || pre.targetRole || user.targetRole;
      updateProfile({
        ...(pre.currentRole ? { currentRole: pre.currentRole } : {}),
        ...(pre.targetRole ? { targetRole: pre.targetRole } : {}),
        ...(pre.experience ? { experience: pre.experience } : {}),
        ...(pre.skills?.length ? { skills: pre.skills } : {}),
        ...(pre.summary ? { bio: pre.summary } : {}),
        ...(pre.careerGoal ? { careerGoal: pre.careerGoal } : {}),
        ...(pre.education ? { education: pre.education } : {}),
        ...(pre.linkedIn ? { linkedIn: pre.linkedIn } : {}),
        atsOptimized: true,
        resumeUploaded: true,
        targetRole: roleTarget,
      });

      const nextAts =
        polled.atsScore != null && Number.isFinite(polled.atsScore)
          ? Math.min(100, Math.round(polled.atsScore))
          : Math.min(95, atsScore + 6);
      setAtsScore(nextAts);

      const doc = buildInitialResumeFromProfile({
        name: user.name,
        email: user.email,
        currentRole: pre.currentRole || user.currentRole,
        experience: pre.experience || user.experience,
        skills: pre.skills?.length ? pre.skills : user.skills,
        education: pre.education || user.education,
        bio: resumeText.trim() || pre.summary || user.bio,
        projects: user.projects,
        certifications: user.certifications.map(c => c.name),
        linkedIn: pre.linkedIn || user.linkedIn,
        github: user.github,
        targetRole: roleTarget,
      });
      setResumeDoc(doc);
      setSuggestions(generateSuggestions(doc));
      setScoreBeforeStudio(atsScore);
      addXP(250);
      setWizardStep('ats');
      setTab('score');
      pendingResumeIdRef.current = null;
      setHasPendingUploadedResume(false);
      void refresh();
    } catch (e) {
      setIngestError(e instanceof Error ? e.message : 'Analysis failed.');
      setWizardStep('upload');
      setIngestPhase('idle');
      setHasPendingUploadedResume(false);
    } finally {
      setAnalyzeBusy(false);
    }
  }, [resumeText, user, targetRoleDraft, atsScore, setAtsScore, addXP, updateProfile, refresh]);

  const onPickFiles = useCallback(
    async (list: FileList | null) => {
      const f = list?.[0];
      if (!f) return;
      const ok = validateLocalResumeFile(f);
      if (!ok.ok) {
        setIngestError(ok.message);
        return;
      }
      setIngestError(null);
      setIngestPhase('uploading');
      try {
        await startUpload([f]);
      } catch (err) {
        setIngestPhase('idle');
        setIngestError(err instanceof Error ? err.message : 'Upload failed');
      }
    },
    [startUpload],
  );

  const runAiOptimization = (mode: OptimizeMode) => {
    setOptimizeMode(mode);
    setWizardStep('ai-processing');
    window.setTimeout(() => {
      if (!resumeDoc) return;
      const before = atsScore;
      const nextDoc = applyOptimizeMode(resumeDoc, mode);
      setResumeDoc(nextDoc);
      setSuggestions(generateSuggestions(nextDoc));
      const delta = mode === 'generate' ? 12 : mode === 'rewrite' ? 8 : 5;
      const after = Math.min(98, before + delta);
      setAtsScore(after);
      appendOptimizationHistory({
        id: rid(),
        label: mode === 'polish' ? 'Polish pass' : mode === 'rewrite' ? 'AI rewrite' : 'Full AI resume',
        atsBefore: before,
        atsAfter: after,
        templateId,
        createdAt: new Date().toISOString(),
      });
      addXP(120);
      setWizardStep('editor');
      setMobileStudioTab('preview');
    }, 2600);
  };

  const handleSaveLibrary = () => {
    if (!resumeDoc) return;
    saveResumeToLibrary({
      id: rid(),
      name: `${user.name.split(' ')[0] || 'Resume'} · ${templateId}`,
      templateId,
      atsScoreSnapshot: atsScore,
      updatedAt: new Date().toISOString(),
      document: resumeDoc,
    });
  };

  const handleExportPdf = async () => {
    const el = document.getElementById('resume-export-root');
    if (!el) return;
    const { exportResumeElementToPdf } = await import('../lib/resume/exportPdf');
    await exportResumeElementToPdf(el as HTMLElement, `${user.name.replace(/\s+/g, '_')}_resume`);
  };

  const handleExportDocx = async () => {
    if (!resumeDoc) return;
    const { exportResumeToDocx } = await import('../lib/resume/exportDocx');
    await exportResumeToDocx(resumeDoc, `${user.name.replace(/\s+/g, '_')}_resume`);
  };

  const scoreColor = atsScore >= 80 ? '#10b981' : atsScore >= 60 ? '#f59e0b' : '#f43f5e';
  const scoreLabel = atsScore >= 80 ? 'Excellent' : atsScore >= 70 ? 'Good' : atsScore >= 60 ? 'Fair' : 'Needs Work';

  const atsCategories = useMemo(() => buildAtsCategoriesFromParsed(parsedIntelligence), [parsedIntelligence]);
  const improvements  = useMemo(() => buildImprovementsFromParsed(parsedIntelligence), [parsedIntelligence]);
  const radarData     = useMemo(() => atsCategories.map(c => ({ category: c.name, value: c.score })), [atsCategories]);

  // Summary line from AI analysis
  const analysisSummary = parsedIntelligence
    ? ((parsedIntelligence.atsDeepAnalysis as Record<string, unknown> | undefined)?.summary ??
       (parsedIntelligence.analyzerReport as Record<string, unknown> | undefined)?.summary_comment) as string | undefined
    : undefined;

  const chipIdx = resumeStudioChipIndex(wizardStep);
  const showStepper = wizardStep !== 'upload' && wizardStep !== 'analyzing';
  const stepperLabels = ['ATS scan', 'Gaps', 'Template', 'AI pass', 'Studio'];
  const uploadBusy = ingestPhase !== 'idle' || isUploading || analyzeBusy;

  return (
    <div className="app-page" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
      <div className="flex items-center gap-3 section-pad pt-5 pb-4">
        <button type="button" onClick={() => router.push('/app/dashboard')} className="w-9 h-9 rounded-xl flex items-center justify-center glass-card">
          <ArrowLeft size={18} color="#94a3b8" />
        </button>
        <div>
          <h1 style={{ color: 'var(--cp-text-primary)', fontWeight: 700, fontSize: '1.2rem' }}>ATS + Resume Studio</h1>
          <p style={{ color: 'var(--cp-text-muted)', fontSize: '0.78rem' }}>AI resume builder · templates · export</p>
        </div>
        <div
          className="ml-auto flex items-center gap-1 rounded-xl px-3 py-1.5"
          style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)' }}
        >
          <Zap size={14} color="#f59e0b" />
          <span style={{ color: '#f59e0b', fontSize: '0.8rem', fontWeight: 600 }}>+250 XP</span>
        </div>
      </div>

      {showStepper && (
        <div className="section-pad mb-4 overflow-x-auto">
          <div className="flex items-center gap-1 min-w-max pb-1">
            {stepperLabels.map((label, idx) => {
              const done = idx < chipIdx;
              const current = idx === chipIdx;
              return (
                <div key={label} className="flex items-center">
                  <div
                    className="rounded-full px-3 py-1 text-[0.68rem] font-semibold whitespace-nowrap"
                    style={{
                      background: current ? 'rgba(124,58,237,0.35)' : done ? 'rgba(16,185,129,0.12)' : 'rgba(255,255,255,0.05)',
                      color: current ? '#e9d5ff' : done ? '#6ee7b7' : '#64748b',
                      border: current ? '1px solid rgba(124,58,237,0.5)' : '1px solid rgba(255,255,255,0.06)',
                    }}
                  >
                    {label}
                  </div>
                  {idx < stepperLabels.length - 1 && <ChevronRight size={12} color="#334155" className="mx-0.5 shrink-0" />}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Auto-loaded resume banner */}
      {autoLoadedResume && wizardStep === 'ats' && (
        <div className="section-pad mb-4">
          <div
            className="flex items-center gap-3 rounded-2xl px-4 py-3"
            style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)' }}
          >
            <span className="text-lg">📄</span>
            <div className="flex-1">
              <div style={{ color: '#10b981', fontWeight: 600, fontSize: '0.85rem' }}>Resume loaded from your library</div>
              <div style={{ color: 'var(--cp-text-faint)', fontSize: '0.75rem' }}>{autoLoadedResume.title}</div>
            </div>
            <button
              type="button"
              onClick={() => { setAutoLoadedResume(null); setWizardStep('upload'); }}
              style={{ color: 'var(--cp-text-faint)', fontSize: '0.75rem' }}
            >
              Change
            </button>
          </div>
        </div>
      )}

      {autoLoadError && wizardStep === 'upload' && (
        <div className="section-pad mb-3">
          <p style={{ color: 'var(--cp-text-muted)', fontSize: '0.8rem' }}>{autoLoadError}</p>
        </div>
      )}

      {/* Upload */}
      {wizardStep === 'upload' && (
        <div className="section-pad mb-6">
          <div className="glass-card rounded-3xl p-6">
            <h3 style={{ color: 'var(--cp-text-primary)', fontWeight: 700, marginBottom: '8px' }}>1 · Upload or paste resume</h3>
            <p style={{ color: 'var(--cp-text-muted)', fontSize: '0.82rem', marginBottom: '16px' }}>
              We combine your profile, pasted text, and target role to seed the AI builder. ATS analysis runs next.
            </p>

            <label className="block mb-4">
              <span style={{ color: 'var(--cp-text-muted)', fontSize: '0.75rem' }}>Target role (for AI keywords)</span>
              <input
                value={targetRoleDraft}
                onChange={e => setTargetRoleDraft(e.target.value)}
                className="w-full mt-1 rounded-xl px-4 py-3 outline-none"
                style={{ background: 'var(--cp-bg-card)', border: '1px solid var(--cp-border)', color: 'var(--cp-text-primary)', fontSize: '0.85rem' }}
              />
            </label>

            <input
              ref={fileInputRef}
              type="file"
              accept={RESUME_ACCEPT}
              className="hidden"
              onChange={e => {
                void onPickFiles(e.target.files);
                e.target.value = '';
              }}
            />

            <div
              role="button"
              tabIndex={0}
              aria-label="Upload resume file"
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  if (!uploadBusy) fileInputRef.current?.click();
                }
              }}
              onDragEnter={e => {
                e.preventDefault();
                setDragActive(true);
              }}
              onDragOver={e => {
                e.preventDefault();
                setDragActive(true);
              }}
              onDragLeave={e => {
                e.preventDefault();
                setDragActive(false);
              }}
              onDrop={e => {
                e.preventDefault();
                setDragActive(false);
                if (!uploadBusy) void onPickFiles(e.dataTransfer.files);
              }}
              onClick={() => {
                if (!uploadBusy) fileInputRef.current?.click();
              }}
              className={`rounded-2xl p-6 text-center mb-4 transition-colors ${uploadBusy ? '' : 'cursor-pointer'}`}
              style={{
                border: `2px dashed ${dragActive ? 'rgba(124,58,237,0.75)' : 'rgba(124,58,237,0.35)'}`,
                background: dragActive ? 'rgba(124,58,237,0.12)' : 'rgba(124,58,237,0.05)',
                opacity: uploadBusy ? 0.75 : 1,
              }}
            >
              {uploadBusy ? (
                <Loader2 className="mx-auto mb-3 animate-spin text-violet-300" size={32} aria-hidden />
              ) : (
                <Upload size={32} color="#7c3aed" className="mx-auto mb-3" aria-hidden />
              )}
              <p style={{ color: '#a78bfa', fontWeight: 600 }}>
                {ingestPhase === 'uploading'
                  ? 'Uploading file…'
                  : ingestPhase === 'parsing'
                    ? 'Saving & parsing resume…'
                    : 'Drop a file here or tap to browse'}
              </p>
              <p style={{ color: 'var(--cp-text-faint)', fontSize: '0.78rem' }}>PDF, DOC, DOCX, or TXT · up to 10MB</p>
              <div className="mt-4 flex flex-col items-center gap-2" onClick={e => e.stopPropagation()}>
                <ResumeUploadButton
                  endpoint="resume"
                  disabled={uploadBusy}
                  onClientUploadComplete={res => void handleUtFilesComplete(res)}
                  onUploadError={e => setIngestError(e.message)}
                  appearance={{
                    button:
                      'bg-violet-600 hover:bg-violet-500 border-0 text-white rounded-xl px-4 py-2 text-sm font-semibold cursor-pointer disabled:opacity-50',
                    allowedContent: 'text-xs mt-1 opacity-60',
                  }}
                  content={{ button: uploadBusy ? 'Working…' : 'Choose file (cloud)' }}
                />
              </div>
            </div>

            {hasPendingUploadedResume ? (
              <p style={{ color: '#10b981', fontSize: '0.78rem', marginBottom: 12 }}>
                Resume uploaded — tap &quot;Run ATS analysis&quot; to pull your latest ATS score from the server.
              </p>
            ) : null}

            {ingestError ? (
              <p style={{ color: '#f87171', fontSize: '0.82rem', marginBottom: 12 }} role="alert">
                {ingestError}
              </p>
            ) : null}

            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1 h-px" style={{ background: 'var(--cp-bg-elevated)' }} />
              <span style={{ color: 'var(--cp-text-faint)', fontSize: '0.8rem' }}>resume text</span>
              <div className="flex-1 h-px" style={{ background: 'var(--cp-bg-elevated)' }} />
            </div>

            <textarea
              value={resumeText}
              onChange={e => setResumeText(e.target.value)}
              placeholder="Paste your resume content here (optional if you uploaded a file or have a full profile)..."
              rows={6}
              disabled={uploadBusy}
              className="w-full rounded-xl px-4 py-3 outline-none resize-none"
              style={{ background: 'var(--cp-bg-card)', border: '1px solid var(--cp-border)', color: 'var(--cp-text-primary)', fontSize: '0.85rem' }}
            />

            <motion.button
              type="button"
              onClick={() => void handleAnalyze()}
              disabled={uploadBusy}
              whileTap={{ scale: uploadBusy ? 1 : 0.97 }}
              className="btn-primary w-full py-4 rounded-2xl flex items-center justify-center gap-3 mt-4 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ fontWeight: 700, fontSize: '1rem' }}
            >
              {analyzeBusy ? (
                <Loader2 className="animate-spin" size={20} aria-hidden />
              ) : (
                <Zap size={20} />
              )}
              Run ATS analysis
              <span style={{ opacity: 0.8, fontSize: '0.8rem' }}>+250 XP</span>
            </motion.button>
          </div>
        </div>
      )}

      {/* Analyzing */}
      {wizardStep === 'analyzing' && (
        <div className="section-pad mb-8">
          <div className="glass-card rounded-3xl p-10 text-center">
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }} className="text-4xl mb-4 inline-block">
              ⚙️
            </motion.div>
            <h3 style={{ color: 'var(--cp-text-primary)', fontWeight: 700 }}>Scanning ATS signals…</h3>
            <p style={{ color: 'var(--cp-text-muted)', fontSize: '0.85rem', marginTop: 8 }}>
              {ingestPhase === 'parsing'
                ? 'Waiting for server-side resume intelligence (Gemini + ATS). This can take up to a minute.'
                : 'Preparing your dashboard and resume preview…'}
            </p>
          </div>
        </div>
      )}

      {/* ATS dashboard */}
      {wizardStep === 'ats' && (
        <>
          <div className="section-pad mb-5">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="rounded-3xl p-5 text-center relative overflow-hidden"
              style={{
                background: 'linear-gradient(135deg, rgba(124,58,237,0.15), rgba(6,182,212,0.08))',
                border: '1px solid rgba(124,58,237,0.25)',
              }}
            >
              <div className="absolute top-0 right-0 w-32 h-32 rounded-full opacity-5" style={{ background: `radial-gradient(circle, ${scoreColor}, transparent)`, transform: 'translate(20%, -20%)' }} />
              <div className="flex justify-center mb-2">
                <ScoreGauge score={atsScore} />
              </div>
              <div style={{ color: scoreColor, fontWeight: 700, fontSize: '1rem' }}>{scoreLabel}</div>
              {analysisSummary ? (
                <p style={{ color: 'var(--cp-text-muted)', fontSize: '0.78rem', marginTop: '6px', lineHeight: 1.5, maxWidth: '340px', margin: '6px auto 0' }}>{String(analysisSummary)}</p>
              ) : (
                <div style={{ color: 'var(--cp-text-muted)', fontSize: '0.78rem', marginTop: '4px' }}>Beat {atsScore > 72 ? '65%' : '45%'} of applicants in your field</div>
              )}
              <div className="flex justify-around mt-4 pt-4" style={{ borderTop: '1px solid var(--cp-border)' }}>
                {[
                  { label: 'Target', value: '85+', color: '#10b981' },
                  { label: 'Current', value: `${atsScore}`, color: scoreColor },
                  { label: 'Gap', value: `${Math.max(85 - atsScore, 0)}`, color: '#f59e0b' },
                ].map(s => (
                  <div key={s.label}>
                    <div style={{ color: s.color, fontWeight: 700, fontSize: '1.2rem' }}>{s.value}</div>
                    <div style={{ color: 'var(--cp-text-faint)', fontSize: '0.72rem' }}>{s.label}</div>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>

          <div className="section-pad mb-5">
            <div className="flex rounded-2xl p-1" style={{ background: 'var(--cp-bg-card)' }}>
              {(['score', 'improve', 'radar'] as const).map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
                  className="flex-1 py-2.5 rounded-xl capitalize transition-all"
                  style={{
                    background: tab === t ? 'rgba(124,58,237,0.25)' : 'transparent',
                    color: tab === t ? '#a78bfa' : '#64748b',
                    fontWeight: tab === t ? 600 : 400,
                    fontSize: '0.8rem',
                    border: tab === t ? '1px solid rgba(124,58,237,0.35)' : '1px solid transparent',
                  }}
                >
                  {t === 'score' ? '📊 Score' : t === 'improve' ? '🎯 Improve' : '🕸️ Radar'}
                </button>
              ))}
            </div>
          </div>

          <div className="section-pad mb-5">
            <AnimatePresence mode="wait">
              {tab === 'score' && (
                <motion.div key="score" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                  <div className="space-y-3">
                    {atsCategories.map((cat, i) => (
                      <motion.button
                        key={cat.name}
                        type="button"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.07 }}
                        onClick={() => setSelectedCategory(selectedCategory === cat.name ? null : cat.name)}
                        className="w-full glass-card rounded-2xl p-4 text-left"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span style={{ color: 'var(--cp-text-primary)', fontWeight: 600 }}>{cat.name}</span>
                          <span style={{ color: cat.color, fontWeight: 700 }}>{cat.score}/100</span>
                        </div>
                        <div className="rounded-full overflow-hidden" style={{ background: 'var(--cp-bg-elevated)', height: '6px' }}>
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${cat.score}%` }}
                            transition={{ duration: 1, delay: i * 0.1 }}
                            style={{ height: '100%', borderRadius: '999px', background: cat.color, boxShadow: `0 0 8px ${cat.color}60` }}
                          />
                        </div>
                        <AnimatePresence>
                          {selectedCategory === cat.name && (
                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                              <div className="mt-3 flex items-start gap-2 rounded-xl p-3" style={{ background: `${cat.color}10`, border: `1px solid ${cat.color}25` }}>
                                <AlertCircle size={14} color={cat.color} className="mt-0.5 shrink-0" />
                                <p style={{ color: 'var(--cp-text-muted)', fontSize: '0.8rem' }}>{cat.tip}</p>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.button>
                    ))}
                  </div>
                </motion.div>
              )}

              {tab === 'improve' && (
                <motion.div key="improve" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                  <div className="space-y-3">
                    {improvements.map((item, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.07 }}
                        className="glass-card rounded-2xl p-4 flex items-center gap-3"
                      >
                        <div className="text-xl shrink-0">{item.icon}</div>
                        <div className="flex-1">
                          <p style={{ color: 'var(--cp-text-primary)', fontSize: '0.85rem' }}>{item.text}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <div
                              className="rounded-md px-2 py-0.5"
                              style={{ background: `${priorityColors[item.priority]}15`, border: `1px solid ${priorityColors[item.priority]}30` }}
                            >
                              <span style={{ color: priorityColors[item.priority], fontSize: '0.65rem', fontWeight: 700 }}>{item.priority.toUpperCase()}</span>
                            </div>
                            <span style={{ color: '#10b981', fontSize: '0.75rem', fontWeight: 600 }}>{item.impact}</span>
                          </div>
                        </div>
                        <ChevronRight size={16} color="#475569" />
                      </motion.div>
                    ))}
                  </div>
                  <motion.button
                    type="button"
                    onClick={handleAnalyze}
                    whileTap={{ scale: 0.97 }}
                    className="w-full mt-5 py-4 rounded-2xl flex items-center justify-center gap-3"
                    style={{ background: 'linear-gradient(135deg, #7c3aed, #06b6d4)', border: 'none', color: 'white', fontWeight: 700, fontSize: '1rem' }}
                  >
                    <TrendingUp size={20} />
                    Re-analyze resume
                    <span style={{ opacity: 0.8, fontSize: '0.8rem' }}>+250 XP</span>
                  </motion.button>
                </motion.div>
              )}

              {tab === 'radar' && (
                <motion.div key="radar" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                  <div className="glass-card rounded-3xl p-5">
                    <h3 style={{ color: 'var(--cp-text-primary)', fontWeight: 700, marginBottom: '4px' }}>ATS Analysis Radar</h3>
                    <p style={{ color: 'var(--cp-text-muted)', fontSize: '0.78rem', marginBottom: '12px' }}>Your resume vs. optimal ATS profile</p>
                    <ResponsiveContainer width="100%" height={220}>
                      <RadarChart data={radarData}>
                        <PolarGrid stroke="var(--cp-border)" />
                        <PolarAngleAxis dataKey="category" tick={{ fill: 'var(--cp-text-muted)', fontSize: 10 }} />
                        <Radar name="Your Resume" dataKey="value" stroke="#7c3aed" fill="#7c3aed" fillOpacity={0.25} />
                        <Radar name="Optimal" dataKey={() => 100} stroke="#10b981" fill="#10b981" fillOpacity={0.06} strokeDasharray="4 4" />
                      </RadarChart>
                    </ResponsiveContainer>
                    <div className="flex items-center justify-center gap-6 mt-2">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-0.5 rounded" style={{ background: '#7c3aed' }} />
                        <span style={{ color: 'var(--cp-text-muted)', fontSize: '0.72rem' }}>Your resume</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-0.5 rounded" style={{ background: '#10b981' }} />
                        <span style={{ color: 'var(--cp-text-muted)', fontSize: '0.72rem' }}>Optimal</span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="section-pad mb-8 flex flex-col gap-3">
            <motion.button
              type="button"
              whileTap={{ scale: 0.98 }}
              onClick={() => setWizardStep('improvements')}
              className="w-full py-4 rounded-2xl flex items-center justify-center gap-2 font-bold"
              style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)', color: 'white', border: 'none' }}
            >
              Continue · Review improvements
              <ChevronRight size={18} />
            </motion.button>
            <button type="button" onClick={goBack} className="text-center text-sm" style={{ color: 'var(--cp-text-muted)', background: 'none', border: 'none' }}>
              ← Edit upload
            </button>
          </div>
        </>
      )}

      {/* Improvements list (dedicated step) */}
      {wizardStep === 'improvements' && (
        <div className="section-pad mb-8">
          <h3 style={{ color: 'var(--cp-text-primary)', fontWeight: 700, marginBottom: 12 }}>2 · Prioritized improvements</h3>
          <p style={{ color: 'var(--cp-text-muted)', fontSize: '0.82rem', marginBottom: 16 }}>These map to ATS parsers and recruiter skim patterns. Next, pick a template and run AI optimization.</p>
          <div className="space-y-3 mb-6">
            {improvements.map((item, i) => (
              <div key={i} className="glass-card rounded-2xl p-4 flex items-center gap-3">
                <div className="text-xl shrink-0">{item.icon}</div>
                <div className="flex-1">
                  <p style={{ color: 'var(--cp-text-primary)', fontSize: '0.85rem' }}>{item.text}</p>
                  <span style={{ color: '#10b981', fontSize: '0.75rem', fontWeight: 600 }}>{item.impact}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-3">
            <motion.button type="button" whileTap={{ scale: 0.98 }} onClick={() => setWizardStep('template')} className="btn-primary w-full py-4 rounded-2xl font-bold">
              Choose resume template
            </motion.button>
            <button type="button" onClick={goBack} className="text-sm" style={{ color: 'var(--cp-text-muted)', background: 'none', border: 'none' }}>
              ← Back to ATS
            </button>
          </div>
        </div>
      )}

      {/* Template */}
      {wizardStep === 'template' && resumeDoc && (
        <div className="section-pad mb-8">
          <TemplateGallery selectedId={templateId} onSelect={setTemplateId} previewDoc={resumeDoc} />
          <div className="flex flex-col gap-3 mt-6">
            <motion.button type="button" whileTap={{ scale: 0.98 }} onClick={() => setWizardStep('optimize-mode')} className="btn-primary w-full py-4 rounded-2xl font-bold">
              Continue · AI optimization
            </motion.button>
            <button type="button" onClick={goBack} className="text-sm" style={{ color: 'var(--cp-text-muted)', background: 'none', border: 'none' }}>
              ← Back
            </button>
          </div>
        </div>
      )}

      {/* Optimize mode */}
      {wizardStep === 'optimize-mode' && resumeDoc && (
        <div className="section-pad mb-8">
          <h3 style={{ color: 'var(--cp-text-primary)', fontWeight: 700, marginBottom: 8 }}>3 · How should AI optimize?</h3>
          <p style={{ color: 'var(--cp-text-muted)', fontSize: '0.82rem', marginBottom: 20 }}>Polish keeps your voice; rewrite restructures bullets; generate creates an executive-ready narrative.</p>
          <div className="grid grid-cols-1 gap-3">
            {(
              [
                { id: 'polish' as const, title: 'Optimize existing', desc: 'Light pass: keywords, summary tightening, stronger verbs.', badge: 'Fast' },
                { id: 'rewrite' as const, title: 'Rewrite with AI', desc: 'Full bullet rewrite, skills alignment, readability upgrade.', badge: 'Balanced' },
                { id: 'generate' as const, title: 'Generate new resume', desc: 'Fresh narrative, achievement stack, ATS keyword weave.', badge: 'Deep' },
              ] satisfies { id: OptimizeMode; title: string; desc: string; badge: string }[]
            ).map((m, i) => (
              <motion.button
                key={m.id}
                type="button"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
                onClick={() => runAiOptimization(m.id)}
                className="text-left rounded-2xl p-5 glass-card"
                style={{ border: '1px solid rgba(124,58,237,0.25)' }}
              >
                <div className="flex justify-between items-start gap-2 mb-2">
                  <div style={{ color: 'var(--cp-text-primary)', fontWeight: 700 }}>{m.title}</div>
                  <span className="text-[0.65rem] font-bold px-2 py-0.5 rounded-md" style={{ background: 'rgba(6,182,212,0.15)', color: '#67e8f9' }}>
                    {m.badge}
                  </span>
                </div>
                <p style={{ color: 'var(--cp-text-muted)', fontSize: '0.82rem', lineHeight: 1.45 }}>{m.desc}</p>
              </motion.button>
            ))}
          </div>
          <button type="button" onClick={goBack} className="mt-4 text-sm" style={{ color: 'var(--cp-text-muted)', background: 'none', border: 'none' }}>
            ← Back to templates
          </button>
        </div>
      )}

      {/* AI processing */}
      {wizardStep === 'ai-processing' && (
        <div className="section-pad mb-8">
          <div className="glass-card rounded-3xl p-10 text-center">
            <Sparkles className="mx-auto mb-4 text-violet-400" size={40} />
            <h3 style={{ color: 'var(--cp-text-primary)', fontWeight: 700 }}>AI is reshaping your resume…</h3>
            <p style={{ color: 'var(--cp-text-muted)', fontSize: '0.85rem', marginTop: 8 }}>
              Applying {optimizeMode === 'polish' ? 'polish' : optimizeMode === 'rewrite' ? 'rewrite' : 'generation'} with template {templateId}.
            </p>
            <motion.div className="mt-6 h-1 rounded-full overflow-hidden mx-auto max-w-xs" style={{ background: 'var(--cp-bg-elevated)' }}>
              <motion.div
                initial={{ width: '0%' }}
                animate={{ width: '100%' }}
                transition={{ duration: 2.4, ease: 'easeInOut' }}
                style={{ height: '100%', background: 'linear-gradient(90deg,#7c3aed,#06b6d4)' }}
              />
            </motion.div>
          </div>
        </div>
      )}

      {/* Editor + preview + AI */}
      {wizardStep === 'editor' && resumeDoc && (
        <div className="section-pad pb-10">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <h3 style={{ color: 'var(--cp-text-primary)', fontWeight: 700 }}>Resume studio</h3>
              <p style={{ color: 'var(--cp-text-muted)', fontSize: '0.78rem' }}>Live preview · inline edits · AI suggestions</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setPreviewMode('desktop')}
                className="rounded-xl px-3 py-2 flex items-center gap-1 text-[0.78rem] font-semibold"
                style={{
                  background: previewMode === 'desktop' ? 'rgba(124,58,237,0.25)' : 'rgba(255,255,255,0.05)',
                  color: previewMode === 'desktop' ? '#e9d5ff' : '#94a3b8',
                  border: '1px solid var(--cp-border)',
                }}
              >
                <Monitor size={14} />
                Desktop
              </button>
              <button
                type="button"
                onClick={() => setPreviewMode('mobile')}
                className="rounded-xl px-3 py-2 flex items-center gap-1 text-[0.78rem] font-semibold"
                style={{
                  background: previewMode === 'mobile' ? 'rgba(124,58,237,0.25)' : 'rgba(255,255,255,0.05)',
                  color: previewMode === 'mobile' ? '#e9d5ff' : '#94a3b8',
                  border: '1px solid var(--cp-border)',
                }}
              >
                <Smartphone size={14} />
                Mobile
              </button>
            </div>
          </div>

          <div className="flex rounded-2xl p-1 mb-4 lg:hidden" style={{ background: 'var(--cp-bg-card)' }}>
            {(
              [
                { id: 'edit' as const, label: 'Edit', Icon: Pencil },
                { id: 'preview' as const, label: 'Preview', Icon: Monitor },
                { id: 'ai' as const, label: 'AI', Icon: Bot },
              ] as const
            ).map(({ id, label, Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setMobileStudioTab(id)}
                className="flex-1 py-2 rounded-xl flex items-center justify-center gap-1 text-[0.78rem] font-semibold"
                style={{
                  background: mobileStudioTab === id ? 'rgba(124,58,237,0.25)' : 'transparent',
                  color: mobileStudioTab === id ? '#ddd6fe' : '#64748b',
                  border: mobileStudioTab === id ? '1px solid rgba(124,58,237,0.35)' : '1px solid transparent',
                }}
              >
                <Icon size={14} />
                {label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className={`lg:col-span-5 ${mobileStudioTab === 'edit' ? 'block' : 'hidden'} lg:block`}>
              <ResumeEditor doc={resumeDoc} onChange={setResumeDoc} />
            </div>
            <div className={`lg:col-span-4 ${mobileStudioTab === 'preview' ? 'block' : 'hidden'} lg:block`}>
              <div className="lg:sticky lg:top-4 space-y-3">
                <ResumePreview
                  doc={resumeDoc}
                  templateId={templateId}
                  previewMode={previewMode}
                  highlightPaths={highlightPaths}
                  exportRootId="resume-export-root"
                />
                <div className="flex flex-col sm:flex-row gap-2">
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.98 }}
                    onClick={handleExportPdf}
                    className="flex-1 py-3 rounded-xl flex items-center justify-center gap-2 font-bold text-[0.85rem]"
                    style={{ background: 'rgba(248,113,113,0.12)', border: '1px solid rgba(248,113,113,0.35)', color: '#fecaca' }}
                  >
                    <FileDown size={16} />
                    PDF
                  </motion.button>
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.98 }}
                    onClick={handleExportDocx}
                    className="flex-1 py-3 rounded-xl flex items-center justify-center gap-2 font-bold text-[0.85rem]"
                    style={{ background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.35)', color: '#93c5fd' }}
                  >
                    <FileDown size={16} />
                    DOCX
                  </motion.button>
                </div>
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.98 }}
                  onClick={handleSaveLibrary}
                  className="w-full py-3 rounded-xl font-bold text-[0.85rem]"
                  style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.35)', color: '#6ee7b7' }}
                >
                  Save to dashboard library
                </motion.button>
              </div>
            </div>
            <div className={`lg:col-span-3 ${mobileStudioTab === 'ai' ? 'block' : 'hidden'} lg:block`}>
              <div className="lg:sticky lg:top-4">
                <AISuggestionsPanel
                  suggestions={suggestions}
                  onChangeSuggestions={setSuggestions}
                  document={resumeDoc}
                  onChangeDocument={setResumeDoc}
                />
              </div>
            </div>
          </div>

          {scoreBeforeStudio !== null && (
            <p className="mt-4 text-center text-[0.75rem]" style={{ color: 'var(--cp-text-muted)' }}>
              ATS {scoreBeforeStudio} → {atsScore} after studio session
            </p>
          )}

          <div className="flex flex-col sm:flex-row gap-3 justify-center mt-8">
            <button
              type="button"
              onClick={() => setWizardStep('template')}
              className="rounded-xl px-5 py-3 font-semibold"
              style={{ background: 'var(--cp-bg-elevated)', border: '1px solid var(--cp-border)', color: 'var(--cp-text-primary)' }}
            >
              Change template
            </button>
            <button
              type="button"
              onClick={() => setWizardStep('optimize-mode')}
              className="rounded-xl px-5 py-3 font-semibold"
              style={{ background: 'rgba(124,58,237,0.2)', border: '1px solid rgba(124,58,237,0.35)', color: '#ddd6fe' }}
              >
              Run AI again
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
