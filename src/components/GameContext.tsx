'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useSession, signOut as nextAuthSignOut } from 'next-auth/react';
import { STORAGE_KEYS } from '@/lib/brand';

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

interface GameContextType {
  user: UserProfile;
  isOnboarded: boolean;
  isAuthenticated: boolean;
  isHydrating: boolean;
  refresh: () => Promise<void>;
  xp: number;
  level: number;
  levelName: string;
  currentLevelXp: number;
  totalXpForNextLevel: number;
  streak: number;
  profileCompletion: number;
  atsScore: number;
  badges: Badge[];
  courses: Course[];
  jobs: Job[];
  /** Full AI roadmap plan (includes stages, milestones, certifications, etc.). */
  roadmapPlan: RoadmapPlan | null;
  showXpBurst: boolean;
  lastXpGain: number;
  /** True if the user has already claimed their daily bonus today (server-driven). */
  alreadyClaimedToday: boolean;
  signOut: () => void;
  addXP: (amount: number) => void;
  updateProfile: (data: Partial<UserProfile>) => Promise<boolean>;
  setAtsScore: (score: number) => void;
  completeLesson: (courseId: string, moduleId: string, lessonId: string, xpReward?: number) => void;
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
};

const GameContext = createContext<GameContextType | null>(null);

export function GameProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const [isOnboarded, setIsOnboarded] = useState(false);
  const [isHydratingApp, setIsHydratingApp] = useState(true);

  const [user, setUser] = useState<UserProfile>(initialUser);
  const [xp, setXp] = useState(0);
  const [streak, setStreak] = useState(0);
  const [atsScore, setAtsScore] = useState(0);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [showXpBurst, setShowXpBurst] = useState(false);
  const [lastXpGain, setLastXpGain] = useState(0);
  const [roadmapPlan, setRoadmapPlan] = useState<RoadmapPlan | null>(null);
  const [alreadyClaimedToday, setAlreadyClaimedToday] = useState(false);
  const isAuthenticated = status === 'authenticated';
  const isHydrating = status === 'loading' || isHydratingApp;

  const { level, currentLevelXp, totalXpForNextLevel, levelName } = calculateLevel(xp);
  const profileCompletion = calculateProfileCompletion(user);

  const addXP = useCallback((amount: number) => {
    // Optimistic UI update; server will correct from persisted gamification state.
    setXp(prev => prev + amount);
    setLastXpGain(amount);
    setShowXpBurst(true);
    setTimeout(() => setShowXpBurst(false), 2000);

    void (async () => {
      try {
        const res = await fetch('/api/v1/gamification/award', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amount }),
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
      const res = await fetch('/api/v1/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cleaned),
        credentials: 'include',
      });
      if (!res.ok) {
        console.warn('[updateProfile] server rejected update:', await res.text().catch(() => ''));
        return false;
      }
      return true;
    } catch {
      return false;
    }
  }, [session?.user?.id]);

  const signOut = useCallback(() => {
    // Clear onboarding cache so the next user on the same browser starts fresh.
    if (session?.user?.id) {
      try { clearOnboardingCache(session.user.id); } catch { /* ignore */ }
    }
    void nextAuthSignOut({ redirect: false }).finally(() => {
      setUser(initialUser);
      setIsOnboarded(false);
      setXp(0);
      setStreak(0);
      setAtsScore(0);
      setBadges([]);
      setCourses([]);
      setJobs([]);
    });
  }, []);

  const refreshFromServer = useCallback(async () => {
    if (!session?.user?.id) return;

    setIsHydratingApp(true);
    try {
      const meRes = await fetch('/api/v1/me', { credentials: 'include' });
      if (!meRes.ok) throw new Error('Failed to load /api/v1/me');
      const meJson = await meRes.json();

      const data = meJson?.data ?? {};
      const apiUser = data.user ?? {};
      const profile = data.profile ?? {};
      const skills = Array.isArray(data.skills) ? data.skills : [];
      const latestResume = data.latestResume ?? null;
      const gamification = data.gamification ?? null;
      const rawCerts = Array.isArray(data.certifications) ? data.certifications : [];

      const mappedSkills = skills
        .map((s: { skill?: { label?: string } }) => s?.skill?.label)
        .filter(Boolean) as string[];

      const ats = latestResume?.atsScore ?? null;
      const resumeComplete = latestResume?.parseStatus === 'COMPLETE';

      setUser(prev => ({
        ...prev,
        name: apiUser?.name ?? prev.name,
        email: apiUser?.email ?? '',
        photo: apiUser?.image ?? null,
        currentRole: profile?.currentRole ?? '',
        experience: profile?.experienceYears ?? '',
        skills: mappedSkills,
        education: profile?.education ?? '',
        certifications: rawCerts.map((c: Record<string, unknown>): UserCertification => ({
          id: String(c.id ?? ''),
          name: String(c.name ?? ''),
          issuer: String(c.issuer ?? ''),
          issueDate: (c.issueDate as string | null) ?? null,
          expiryDate: (c.expiryDate as string | null) ?? null,
          credentialId: (c.credentialId as string | null) ?? null,
          credentialUrl: (c.credentialUrl as string | null) ?? null,
        })),
        careerGoal: profile?.careerGoal ?? '',
        targetRole: profile?.targetRole ?? '',
        preferredIndustry: profile?.preferredIndustry ?? '',
        preferredIndustries: Array.isArray(profile?.preferredIndustries) ? profile.preferredIndustries : [],
        linkedIn: profile?.linkedInUrl ?? '',
        github: profile?.githubUrl ?? '',
        bio: profile?.bio ?? '',
        salaryGoal: profile?.salaryExpectation ?? '',
        currentSalary: profile?.currentSalary ?? '',
        salaryCurrency: profile?.salaryCurrency ?? 'USD',
        salaryFrequency: profile?.salaryFrequency ?? 'Annual',
        compensationType: profile?.compensationType ?? '',
        country: profile?.country ?? '',
        locationPreference: profile?.locationPreference ?? '',
        resumeUploaded: Boolean(resumeComplete),
        atsOptimized: ats != null ? Number(ats) >= 80 : false,
        projects: [],
        themePreference: (profile?.themePreference ?? 'system') as 'dark' | 'light' | 'system',
      }));
      setAlreadyClaimedToday(Boolean(data.alreadyClaimedToday));

      const onboarded = Boolean(profile?.onboardingComplete);
      setIsOnboarded(onboarded);
      // Cache onboarding status so a transient ME failure on reload
      // doesn't incorrectly redirect an authenticated user to onboarding.
      if (onboarded && session?.user?.id) {
        try { writeOnboardingCache(session.user.id); } catch { /* ignore */ }
      }
      setAtsScore(ats != null ? Number(ats) : 0);
      setXp(gamification?.xp != null ? Number(gamification.xp) : 0);
      setStreak(gamification?.streak != null ? Number(gamification.streak) : 0);
      setBadges(Array.isArray(gamification?.badges) ? (gamification.badges as Badge[]) : []);

      try {
        const jobsRes = await fetch('/api/v1/jobs/recommendations', { credentials: 'include' });
        if (jobsRes.ok) {
          const jobsJson = await jobsRes.json();
          const ranked = Array.isArray(jobsJson?.data) ? jobsJson.data : [];
          setJobs(
            ranked.map((r: Record<string, unknown>) => {
              const job = r?.job as Record<string, unknown> | undefined;
              return {
                id: (job?.id as string) ?? String(r?.id ?? Math.random()),
                title: (job?.title as string) ?? 'Untitled role',
                company: (job?.company as string) ?? 'Unknown',
                location: (job?.location as string) ?? 'Remote',
                salary: [job?.salaryMin, job?.salaryMax].filter(v => typeof v === 'number').length
                  ? `$${job?.salaryMin}k–$${job?.salaryMax}k`
                  : '',
                matchPercent: Number(r?.score ?? 0),
                missingSkills: [],
                xpReward: Math.max(50, Math.round(Number(r?.score ?? 0) * 1.2)),
                type: 'Full-time',
                postedDays: 0,
                logo: '🏢',
                url: typeof job?.url === 'string' ? job.url : undefined,
              };
            }),
          );
        } else {
          setJobs([]);
        }
      } catch {
        setJobs([]);
      }

      try {
        const roadmapRes = await fetch('/api/v1/learning/roadmap', { credentials: 'include' });
        const roadmapJson = roadmapRes.ok ? await roadmapRes.json() : null;
        const roadmapData = roadmapJson?.data ?? null;
        if (!roadmapData?.roadmap?.jsonPlan?.modules) {
          setCourses([]);
          setRoadmapPlan(null);
        } else {
          setRoadmapPlan(roadmapData.roadmap.jsonPlan as RoadmapPlan);
          const modules = roadmapData.roadmap.jsonPlan.modules ?? [];
          const resources = Array.isArray(roadmapData.resources) ? roadmapData.resources : [];
          const byResourceId = roadmapData.progress?.byResourceId ?? {};

          const coursesMapped: Course[] = modules.map((m: Record<string, unknown>, idx: number) => {
            const moduleResources = resources.filter(
              (r: { moduleTitle?: string }) => r.moduleTitle === m.title,
            );
            const lessons: Lesson[] = moduleResources.map((r: Record<string, unknown>, rIdx: number) => {
              const completion = byResourceId?.[r.resourceId as string];
              const completed = Boolean(completion?.completed);
              return {
                id: String(r.resourceId ?? `c-${idx}-l-${rIdx}`),
                title: String(r.title ?? 'Lesson'),
                duration: '10 min',
                type: 'reading',
                completed,
              };
            });
            const allCompleted = lessons.length ? lessons.every(l => l.completed) : false;
            const progress = lessons.length
              ? Math.round((lessons.filter(l => l.completed).length / lessons.length) * 100)
              : 0;
            return {
              id: `course-${idx}`,
              title: String(m.title ?? 'Module'),
              description: String(m.title ?? ''),
              category: 'Learning',
              difficulty: 'Intermediate',
              estimatedDays: roadmapData.roadmap.jsonPlan.weeks
                ? Math.max(1, Math.round(roadmapData.roadmap.jsonPlan.weeks / modules.length))
                : 7,
              totalXp: 600,
              progress,
              modules: [
                {
                  id: `course-${idx}-m-0`,
                  title: String(m.title ?? ''),
                  description: String(m.title ?? ''),
                  locked: false,
                  completed: allCompleted,
                  xpReward: 200,
                  lessons,
                },
              ],
              thumbnail: '📚',
              tags: Array.from(new Set(moduleResources.map((r: { provider?: string }) => r.provider))).slice(
                0,
                4,
              ) as string[],
              aiGenerated: true,
            };
          });

          setCourses(coursesMapped);
        }
      } catch {
        setCourses([]);
      }
    } catch (e) {
      console.warn('[GameContext] refreshFromServer failed', e);
      // Don't leave isOnboarded as false for an authenticated user when ME fails
      // transiently (network hiccup, cold start). Read the localStorage cache that
      // we wrote on the last successful ME call so the user isn't kicked to onboarding.
      if (session?.user?.id) {
        try {
          const cached = readOnboardingCache(session.user.id);
          if (cached === '1') setIsOnboarded(true);
        } catch { /* ignore */ }
      }
    } finally {
      setIsHydratingApp(false);
    }
  }, [session?.user?.id]);

  useEffect(() => {
    if (!session?.user?.id) {
      setIsHydratingApp(false);
      return;
    }
    void refreshFromServer();
  }, [session?.user?.id, refreshFromServer]);

  const completeLesson = useCallback((courseId: string, moduleId: string, lessonId: string, xpReward = 80) => {
    setCourses(prev => prev.map(course => {
      if (course.id !== courseId) return course;
      const updatedModules = course.modules.map(mod => {
        if (mod.id !== moduleId) return mod;
        const updatedLessons = mod.lessons.map(l =>
          l.id === lessonId ? { ...l, completed: true } : l
        );
        const allCompleted = updatedLessons.every(l => l.completed);
        return { ...mod, lessons: updatedLessons, completed: allCompleted };
      });
      const completedModules = updatedModules.filter(m => m.completed).length;
      const progress = Math.round((completedModules / updatedModules.length) * 100);
      return { ...course, modules: updatedModules, progress };
    }));
    addXP(xpReward);

    // Persist completion server-side (no-op on duplicates).
    void (async () => {
      try {
        await fetch('/api/v1/learning/progress/complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ resourceId: lessonId }),
          credentials: 'include',
        });
      } catch {
        // Non-fatal: keep optimistic UI.
      }
    })();
  }, [addXP]);

  const addCourse = useCallback((course: Course) => {
    setCourses(prev => [course, ...prev]);
    addXP(150);
  }, [addXP]);

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
      streak, profileCompletion, atsScore, badges, courses, jobs, roadmapPlan,
      showXpBurst, lastXpGain, alreadyClaimedToday,
      isHydrating,
      refresh: refreshFromServer,
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
