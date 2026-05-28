'use client';

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { signOutUser, signOutUnregistered } from '@/lib/auth/sign-out';
import { getQueryClient } from '@/lib/query-client';
import { invalidateInsightsQueries, insightsQueryKeys } from '@/lib/insights/query-keys';
import { apiFetch, apiFetchJson, parseApiError } from '@/lib/api/client';
import { normalizeCourse } from '@/lib/courses/normalize';
import { STORAGE_KEYS } from '@/lib/brand';
import { formatJobSalaryRange, resolveSalaryLocale } from '@/lib/salary/locale';

function readOnboardingCache(userId: string): string | null {
  try {
    return localStorage.getItem(STORAGE_KEYS.onboardingCache(userId))
      ?? localStorage.getItem(STORAGE_KEYS.onboardingCacheLegacy(userId));
  } catch {
    return null;
  }
}

function writeOnboardingCache(userId: string) {
  try {
    localStorage.setItem(STORAGE_KEYS.onboardingCache(userId), '1');
  } catch { /* ignore */ }
}

function clearOnboardingCache(userId: string) {
  try {
    localStorage.removeItem(STORAGE_KEYS.onboardingCache(userId));
    localStorage.removeItem(STORAGE_KEYS.onboardingCacheLegacy(userId));
  } catch { /* ignore */ }
}

export interface UserCertification {
  id: string;
  name: string;
  issuer: string;
  issueDate?: string | null;
  expiryDate?: string | null;
  credentialId?: string | null;
  credentialUrl?: string | null;
}

export interface UserProfile {
  name: string;
  email: string;
  photo: string | null;
  currentRole: string;
  experience: string;
  skills: string[];
  education: string;
  certifications: UserCertification[];
  careerGoal: string;
  targetRole: string;
  preferredIndustry: string;
  preferredIndustries: string[];
  linkedIn: string;
  github: string;
  bio: string;
  salaryGoal: string;
  salaryGoalCurrency: string;
  salaryGoalFrequency: string;
  currentSalary: string;
  salaryCurrency: string;
  salaryFrequency: string;
  compensationType: string;
  country: string;
  locationPreference: string;
  resumeUploaded: boolean;
  atsOptimized: boolean;
  projects: string[];
  themePreference: 'dark' | 'light' | 'system';
  subscriptionTier: string;
  profileVersion: number;
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  emoji: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  earnedAt: string | null;
  xpReward: number;
}

export interface Lesson {
  id: string;
  title: string;
  duration: string;
  type: 'video' | 'reading' | 'quiz' | 'project';
  completed: boolean;
  content?: string;
  quiz?: Array<{ question: string; options: string[]; correctIndex: number; difficulty?: string }>;
}

export interface Module {
  id: string;
  title: string;
  description: string;
  lessons: Lesson[];
  locked: boolean;
  completed: boolean;
  xpReward: number;
}

export interface Course {
  id: string;
  title: string;
  description: string;
  category: string;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  estimatedDays: number;
  totalXp: number;
  progress: number;
  modules: Module[];
  thumbnail: string;
  tags: string[];
  aiGenerated: boolean;
}

export interface Job {
  id: string;
  title: string;
  company: string;
  location: string;
  salary: string;
  matchPercent: number;
  missingSkills: string[];
  xpReward: number;
  type: string;
  postedDays: number;
  logo: string;
  url?: string;
}

function getLevelName(level: number): string {
  if (level >= 50) return 'AI Career Master';
  if (level >= 35) return 'Expert';
  if (level >= 20) return 'Professional';
  if (level >= 10) return 'Builder';
  if (level >= 5) return 'Learner';
  return 'Explorer';
}

function calculateLevel(xp: number) {
  const level = Math.floor(xp / 500) + 1;
  const currentLevelXp = xp % 500;
  return { level, currentLevelXp, totalXpForNextLevel: 500, levelName: getLevelName(level) };
}

function calculateProfileCompletion(user: UserProfile): number {
  let score = 0;
  if (user.resumeUploaded) score += 30;
  if (user.linkedIn) score += 20;
  if (user.github) score += 20;
  if (user.certifications.length > 0) score += 15;
  if (user.experience?.trim()) score += 15;
  return Math.min(score, 100);
}

export interface RoadmapPlan {
  title?: string;
  subtitle?: string;
  weeks?: number;
  audience?: string;
  stages?: { title: string; summary?: string; timeframeWeeks?: number }[];
  milestones?: string[];
  certifications?: { title: string; issuer?: string; url?: string }[];
  projectIdeas?: string[];
  industryNotes?: string;
  modules?: unknown[];
}

export type RefreshScope = 'all' | 'me' | 'jobs' | 'courses' | 'roadmap';

interface GameContextType {
  user: UserProfile;
  isOnboarded: boolean;
  isAuthenticated: boolean;
  isHydrating: boolean;
  refresh: (opts?: { silent?: boolean; force?: boolean; scope?: RefreshScope }) => Promise<void>;
  markOnboarded: () => void;
  xp: number;
  level: number;
  levelName: string;
  currentLevelXp: number;
  totalXpForNextLevel: number;
  streak: number;
  profileCompletion: number;
  atsScore: number | null;
  badges: Badge[];
  courses: Course[];
  jobs: Job[];
  jobsLoading: boolean;
  jobsError: string | null;
  /** Full AI roadmap plan (includes stages, milestones, certifications, etc.). */
  roadmapPlan: RoadmapPlan | null;
  showXpBurst: boolean;
  lastXpGain: number;
  /** True if the user has already claimed their daily bonus today (server-driven). */
  alreadyClaimedToday: boolean;
  signOut: () => Promise<void>;
  addXP: (amount: number, opts?: { actionKey?: string; actionType?: string }) => void;
  updateProfile: (data: Partial<UserProfile>) => Promise<boolean>;
  setAtsScore: (score: number | null) => void;
  completeLesson: (
    courseId: string,
    moduleId: string,
    lessonId: string,
    xpReward?: number,
    opts?: { quizScore?: number; timeSpentMinutes?: number },
  ) => void;
  addCourse: (course: Course) => void;
  /** Server-backed daily bonus (+25 XP max once per UTC day). */
  claimDailyBonus: () => Promise<{ claimed: boolean; error?: string }>;
}

const initialUser: UserProfile = {
  name: '',
  email: '',
  photo: null,
  currentRole: '',
  experience: '',
  skills: [],
  education: '',
  certifications: [],
  careerGoal: '',
  targetRole: '',
  preferredIndustry: '',
  preferredIndustries: [],
  linkedIn: '',
  github: '',
  bio: '',
  salaryGoal: '',
  salaryGoalCurrency: 'USD',
  salaryGoalFrequency: 'Annual',
  currentSalary: '',
  salaryCurrency: 'USD',
  salaryFrequency: 'Annual',
  compensationType: '',
  country: '',
  locationPreference: '',
  resumeUploaded: false,
  atsOptimized: false,
  projects: [],
  themePreference: 'system',
  subscriptionTier: 'FREE',
  profileVersion: 0,
};

const GameContext = createContext<GameContextType | null>(null);

export function GameProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const [isOnboarded, setIsOnboarded] = useState(false);
  const [isHydratingApp, setIsHydratingApp] = useState(true);

  const [user, setUser] = useState<UserProfile>(initialUser);
  const [xp, setXp] = useState(0);
  const [streak, setStreak] = useState(0);
  const [atsScore, setAtsScore] = useState<number | null>(null);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [jobsError, setJobsError] = useState<string | null>(null);
  const [showXpBurst, setShowXpBurst] = useState(false);
  const [lastXpGain, setLastXpGain] = useState(0);
  const [roadmapPlan, setRoadmapPlan] = useState<RoadmapPlan | null>(null);
  const [alreadyClaimedToday, setAlreadyClaimedToday] = useState(false);
  const isAuthenticated = status === 'authenticated';
  const isHydrating = status === 'loading' || isHydratingApp;
  const refreshInFlightRef = useRef<Promise<void> | null>(null);
  const lastRefreshAtRef = useRef(0);
  const mountedUserIdRef = useRef<string | null>(null);

  const { level, currentLevelXp, totalXpForNextLevel, levelName } = calculateLevel(xp);
  const profileCompletion = calculateProfileCompletion(user);

  const addXP = useCallback((amount: number, opts?: { actionKey?: string; actionType?: string }) => {
    setXp(prev => prev + amount);
    setLastXpGain(amount);
    setShowXpBurst(true);
    setTimeout(() => setShowXpBurst(false), 2000);

    void (async () => {
      try {
        const res = await fetch('/api/v1/gamification/award', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount,
            ...(opts?.actionKey ? { actionKey: opts.actionKey } : {}),
            ...(opts?.actionType ? { actionType: opts.actionType } : {}),
          }),
          credentials: 'include',
        });

        if (!res.ok) return;
        const json = await res.json();
        const data = json?.data ?? null;

        if (!data) return;
        setXp(Number(data.xp ?? amount));
        setStreak(Number(data.streak ?? 0));
        setBadges(Array.isArray(data.badges) ? (data.badges as Badge[]) : []);
      } catch {
        // Non-fatal: keep optimistic UI.
      }
    })();
  }, []);

  const updateProfile = useCallback(async (data: Partial<UserProfile>): Promise<boolean> => {
    const snapshot = user;
    setUser(prev => ({ ...prev, ...data }));

    if (!session?.user?.id) return false;

    const toUrl = (v?: string) => {
      if (!v) return undefined;
      const t = v.trim();
      if (!t) return undefined;
      if (/^https?:\/\//i.test(t)) return t;
      return `https://${t}`;
    };

    const body: Record<string, unknown> = {
      name: data.name?.trim() || undefined,
      bio: data.bio?.trim() || undefined,
      currentRole: data.currentRole?.trim() || undefined,
      experienceYears: data.experience?.trim() || undefined,
      education: data.education?.trim() || undefined,
      careerGoal: data.careerGoal?.trim() || undefined,
      targetRole: data.targetRole?.trim() || undefined,
      preferredIndustry: data.preferredIndustry?.trim() || undefined,
      preferredIndustries: Array.isArray(data.preferredIndustries) ? data.preferredIndustries : undefined,
      salaryExpectation: data.salaryGoal?.trim() || undefined,
      salaryGoalCurrency: data.salaryGoalCurrency || undefined,
      salaryGoalFrequency: data.salaryGoalFrequency || undefined,
      currentSalary: data.currentSalary?.trim() || undefined,
      salaryCurrency: data.salaryCurrency || undefined,
      salaryFrequency: data.salaryFrequency || undefined,
      compensationType: data.compensationType?.trim() || undefined,
      country: data.country?.trim() || undefined,
      locationPreference: data.locationPreference?.trim() || undefined,
      linkedInUrl: toUrl(data.linkedIn),
      githubUrl: toUrl(data.github),
      skills: data.skills,
    };

    const cleaned = Object.fromEntries(Object.entries(body).filter(([, v]) => v !== undefined));
    if (Object.keys(cleaned).length === 0) return true;

    try {
      await apiFetchJson('/api/v1/profile', {
        method: 'PATCH',
        body: JSON.stringify(cleaned),
      });
      void invalidateInsightsQueries(getQueryClient());
      return true;
    } catch (e) {
      setUser(snapshot);
      const { toast } = await import('sonner');
      toast.error(parseApiError(e, 'Could not save profile changes'));
      return false;
    }
  }, [session?.user?.id, user]);

  const markOnboarded = useCallback(() => {
    setIsOnboarded(true);
    if (session?.user?.id) {
      try { writeOnboardingCache(session.user.id); } catch { /* ignore */ }
    }
  }, [session?.user?.id]);

  const signOut = useCallback(async () => {
    if (session?.user?.id) {
      try { clearOnboardingCache(session.user.id); } catch { /* ignore */ }
    }
    mountedUserIdRef.current = null;
    setUser(initialUser);
    setIsOnboarded(false);
    setXp(0);
    setStreak(0);
    setAtsScore(0);
    setBadges([]);
    setCourses([]);
    setJobs([]);
    setJobsLoading(false);
    setJobsError(null);
    setRoadmapPlan(null);
    await signOutUser();
  }, [session?.user?.id]);

  const refreshFromServer = useCallback(async (opts?: { silent?: boolean; force?: boolean; scope?: RefreshScope }) => {
    if (!session?.user?.id) return;
    const silent = Boolean(opts?.silent);
    const force = Boolean(opts?.force);
    const scope = opts?.scope ?? 'all';
    const wantMe = scope === 'all' || scope === 'me';
    const wantJobs = scope === 'all' || scope === 'jobs';
    const wantCourses = scope === 'all' || scope === 'courses';
    const wantRoadmap = scope === 'all' || scope === 'roadmap';
    const now = Date.now();
    if (!force && now - lastRefreshAtRef.current < 8_000) return;
    if (refreshInFlightRef.current) {
      await refreshInFlightRef.current;
      return;
    }

    const run = (async () => {
      if (!silent) {
        if (wantMe) setIsHydratingApp(true);
        if (wantJobs) setJobsLoading(true);
      }
      if (wantJobs) setJobsError(null);
      try {
        let profileSnapshot: Record<string, unknown> | null = null;

        if (wantMe) {
          const meResult = await apiFetch<Record<string, unknown>>('/api/v1/me', { allowError: true });
          if (!meResult.ok) {
            if (meResult.error.status === 404 && meResult.error.code === 'USER_NOT_REGISTERED') {
              const { toast } = await import('sonner');
              toast.error('Your account is not registered. Please sign up.');
              await signOutUnregistered();
              return;
            }
          } else {
            const data = meResult.data;
            const apiUser = (data.user ?? {}) as Record<string, unknown>;
            const profile = (data.profile ?? {}) as Record<string, unknown>;
            profileSnapshot = profile;
            const skills = Array.isArray(data.skills) ? data.skills : [];
            const latestResume = data.latestResume as Record<string, unknown> | null;
            const gamification = data.gamification as Record<string, unknown> | null;
            const rawCerts = Array.isArray(data.certifications) ? data.certifications : [];

            const mappedSkills = skills
              .map((s: { skill?: { label?: string } }) => s?.skill?.label)
              .filter(Boolean) as string[];

            const ats = latestResume?.atsScore ?? null;
            const resumeComplete = latestResume?.parseStatus === 'COMPLETE';
            const themePreference = (profile?.themePreference ?? 'system') as 'dark' | 'light' | 'system';
            const profileVersion = Number(profile?.profileVersion ?? 0);

            setUser(prev => ({
              ...prev,
              name: (apiUser?.name as string) ?? prev.name,
              email: (apiUser?.email as string) ?? '',
              photo: (apiUser?.image as string) ?? null,
              currentRole: (profile?.currentRole as string) ?? '',
              experience: (profile?.experienceYears as string) ?? '',
              skills: mappedSkills,
              education: (profile?.education as string) ?? '',
              certifications: rawCerts.map((c: Record<string, unknown>): UserCertification => ({
                id: String(c.id ?? ''),
                name: String(c.name ?? ''),
                issuer: String(c.issuer ?? ''),
                issueDate: (c.issueDate as string | null) ?? null,
                expiryDate: (c.expiryDate as string | null) ?? null,
                credentialId: (c.credentialId as string | null) ?? null,
                credentialUrl: (c.credentialUrl as string | null) ?? null,
              })),
              careerGoal: (profile?.careerGoal as string) ?? '',
              targetRole: (profile?.targetRole as string) ?? '',
              preferredIndustry: (profile?.preferredIndustry as string) ?? '',
              preferredIndustries: Array.isArray(profile?.preferredIndustries) ? profile.preferredIndustries as string[] : [],
              linkedIn: (profile?.linkedInUrl as string) ?? '',
              github: (profile?.githubUrl as string) ?? '',
              bio: (profile?.bio as string) ?? '',
              salaryGoal: (profile?.salaryExpectation as string) ?? '',
              salaryGoalCurrency: (profile?.salaryGoalCurrency as string) ?? 'USD',
              salaryGoalFrequency: (profile?.salaryGoalFrequency as string) ?? 'Annual',
              currentSalary: (profile?.currentSalary as string) ?? '',
              salaryCurrency: (profile?.salaryCurrency as string) ?? 'USD',
              salaryFrequency: (profile?.salaryFrequency as string) ?? 'Annual',
              compensationType: (profile?.compensationType as string) ?? '',
              country: (profile?.country as string) ?? '',
              locationPreference: (profile?.locationPreference as string) ?? '',
              resumeUploaded: Boolean(resumeComplete),
              atsOptimized: ats != null ? Number(ats) >= 80 : false,
              projects: [],
              themePreference,
              subscriptionTier: (profile?.subscriptionTier as string) ?? 'FREE',
              profileVersion,
            }));
            setAlreadyClaimedToday(Boolean(data.alreadyClaimedToday));

        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('cp-profile-loaded', {
              detail: {
                themePreference,
                profileVersion,
                onboardingComplete: Boolean(profile?.onboardingComplete),
              },
            }),
          );
        }

            const onboarded = Boolean(profile?.onboardingComplete);
            setIsOnboarded(onboarded);
            if (onboarded && session?.user?.id) {
              try { writeOnboardingCache(session.user.id); } catch { /* ignore */ }
            }
            setAtsScore(ats != null && Number.isFinite(Number(ats)) ? Number(ats) : null);
            setXp(gamification?.xp != null ? Number(gamification.xp) : 0);
            setStreak(gamification?.streak != null ? Number(gamification.streak) : 0);
            setBadges(Array.isArray(gamification?.badges) ? (gamification.badges as Badge[]) : []);
            void getQueryClient().invalidateQueries({ queryKey: insightsQueryKeys.profileAnalytics() });
          }
        }

        const salaryCtx = profileSnapshot ?? {
          salaryCurrency: user.salaryCurrency,
          country: user.country,
          salaryFrequency: user.salaryFrequency,
        };

        if (wantJobs) {
          try {
            const ranked = await apiFetchJson<Record<string, unknown>[]>('/api/v1/jobs/recommendations');
            const list = Array.isArray(ranked) ? ranked : [];
            setJobs(
              list.map((r: Record<string, unknown>) => {
                const job = r?.job as Record<string, unknown> | undefined;
                const reasons = Array.isArray(r?.reasons) ? (r.reasons as string[]) : [];
                const missingSkills = reasons
                  .filter(reason => reason.startsWith('skill:'))
                  .slice(0, 4)
                  .map(reason => reason.replace('skill:', '').trim())
                  .filter(Boolean);
                return {
                  id: (job?.id as string) ?? String(r?.id ?? Math.random()),
                  title: (job?.title as string) ?? 'Untitled role',
                  company: (job?.company as string) ?? 'Unknown',
                  location: (job?.location as string) ?? 'Remote',
                  salary: formatJobSalaryRange(
                    typeof job?.salaryMin === 'number' ? job.salaryMin : null,
                    typeof job?.salaryMax === 'number' ? job.salaryMax : null,
                    resolveSalaryLocale({
                      salaryCurrency:
                        typeof job?.currency === 'string'
                          ? job.currency
                          : (salaryCtx.salaryCurrency as string | undefined) ?? 'USD',
                      country: (salaryCtx.country as string | undefined) ?? '',
                      salaryFrequency:
                        (salaryCtx.salaryFrequency as string | undefined) ?? 'Annual',
                    }),
                  ),
                  matchPercent: Number(r?.score ?? 0),
                  missingSkills,
                  xpReward: Math.max(50, Math.round(Number(r?.score ?? 0) * 1.2)),
                  type: (job?.employmentType as string) ?? 'Full-time',
                  postedDays: Number(job?.postedDays ?? 0),
                  logo: '🏢',
                  url: typeof job?.url === 'string' ? job.url : undefined,
                };
              }),
            );
            setJobsError(null);
          } catch {
            setJobsError('Unable to load job matches right now.');
          }
        }

        if (wantCourses) {
          try {
            const coursesData = await apiFetchJson<{ all?: Course[] }>('/api/v1/courses');
            const all = Array.isArray(coursesData?.all) ? coursesData.all : [];
            setCourses(all.map((c: Course) => normalizeCourse(c)).filter(Boolean) as Course[]);
          } catch {
            setCourses([]);
          }
        }

        if (wantRoadmap) {
          try {
            const roadmapData = await apiFetchJson<{ roadmap?: { jsonPlan?: RoadmapPlan } }>('/api/v1/learning/roadmap');
            if (roadmapData?.roadmap?.jsonPlan) {
              setRoadmapPlan(roadmapData.roadmap.jsonPlan);
            } else {
              setRoadmapPlan(null);
            }
          } catch {
            setRoadmapPlan(null);
          }
        }
      } catch (e) {
        console.warn('[GameContext] refreshFromServer failed', e);
        if (wantJobs) setJobsError(parseApiError(e, 'Unable to refresh your data right now.'));
        if (session?.user?.id) {
          try {
            const cached = readOnboardingCache(session.user.id);
            if (cached === '1') setIsOnboarded(true);
          } catch { /* ignore */ }
        }
      } finally {
        if (!silent) {
          if (wantJobs) setJobsLoading(false);
          if (wantMe) setIsHydratingApp(false);
        }
        lastRefreshAtRef.current = Date.now();
      }
    })();
    if (scope === 'jobs' || scope === 'courses' || scope === 'roadmap') {
      await run;
      return;
    }
    refreshInFlightRef.current = run;
    await run;
    refreshInFlightRef.current = null;
  }, [session?.user?.id, user.country, user.salaryCurrency, user.salaryFrequency]);

  useEffect(() => {
    if (!session?.user?.id) {
      setIsHydratingApp(false);
      mountedUserIdRef.current = null;
      return;
    }
    if (mountedUserIdRef.current === session.user.id) return;
    mountedUserIdRef.current = session.user.id;
    void (async () => {
      await refreshFromServer({ force: true, scope: 'me' });
      await Promise.all([
        refreshFromServer({ silent: true, force: true, scope: 'jobs' }),
        refreshFromServer({ silent: true, force: true, scope: 'courses' }),
        refreshFromServer({ silent: true, force: true, scope: 'roadmap' }),
      ]);
    })();
  }, [session?.user?.id, refreshFromServer]);

  const completeLesson = useCallback((
    courseId: string,
    moduleId: string,
    lessonId: string,
    xpReward = 80,
    opts?: { quizScore?: number; timeSpentMinutes?: number },
  ) => {
    setCourses(prev => prev.map(course => {
      if (course.id !== courseId) return course;
      const updatedModules = course.modules.map(mod => {
        if (mod.id !== moduleId) return mod;
        const updatedLessons = mod.lessons.map(l =>
          l.id === lessonId ? { ...l, completed: true } : l
        );
        const allCompleted = updatedLessons.every(l => l.completed);
        return { ...mod, lessons: updatedLessons, completed: allCompleted, locked: false };
      });
      const totalLessons = updatedModules.flatMap(m => m.lessons).length;
      const done = updatedModules.flatMap(m => m.lessons).filter(l => l.completed).length;
      const progress = totalLessons ? Math.round((done / totalLessons) * 100) : 0;
      return { ...course, modules: updatedModules, progress };
    }));
    addXP(xpReward);

    void (async () => {
      try {
        const res = await fetch('/api/v1/courses/progress', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            courseId,
            lessonId,
            quizScore: opts?.quizScore,
            timeSpentMinutes: opts?.timeSpentMinutes,
          }),
          credentials: 'include',
        });
        if (res.ok) {
          const json = await res.json();
          const updated = json?.data?.course;
          if (updated) {
            const normalized = normalizeCourse(updated);
            if (normalized) {
              setCourses(prev => prev.map(c => (c.id === courseId ? normalized : c)));
            }
          }
        }
      } catch {
        // Non-fatal: keep optimistic UI.
      }
    })();
  }, [addXP]);

  const addCourse = useCallback((course: Course) => {
    const normalized = normalizeCourse(course);
    if (!normalized) return;
    setCourses(prev => {
      if (prev.some(c => c.id === normalized.id)) {
        return prev.map(c => (c.id === normalized.id ? normalized : c));
      }
      return [normalized, ...prev];
    });
  }, []);

  const claimDailyBonus = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/gamification/daily-claim', {
        method: 'POST',
        credentials: 'include',
      });
      const json = await res.json().catch(() => ({}));
      const data = json?.data as { claimed?: boolean; xp?: number; streak?: number; badges?: Badge[] } | undefined;
      if (!res.ok || !data) {
        return { claimed: false as const, error: 'Could not claim daily bonus.' };
      }
      setXp(Number(data.xp ?? 0));
      setStreak(Number(data.streak ?? 0));
      if (Array.isArray(data.badges)) setBadges(data.badges);
      if (data.claimed) {
        setLastXpGain(25);
        setShowXpBurst(true);
        setTimeout(() => setShowXpBurst(false), 2000);
      }
      return { claimed: Boolean(data.claimed) };
    } catch {
      return { claimed: false as const, error: 'Network error' };
    }
  }, []);

  return (
    <GameContext.Provider value={{
      user, isOnboarded, isAuthenticated, xp, level, levelName, currentLevelXp, totalXpForNextLevel,
      streak, profileCompletion, atsScore, badges, courses, jobs, jobsLoading, jobsError, roadmapPlan,
      showXpBurst, lastXpGain, alreadyClaimedToday,
      isHydrating,
      refresh: refreshFromServer, markOnboarded,
      signOut, addXP, updateProfile, setAtsScore, completeLesson, addCourse, claimDailyBonus,
    }}>
      {children}
    </GameContext.Provider>
  );
}

export function useGame() {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used within GameProvider');
  return ctx;
}
