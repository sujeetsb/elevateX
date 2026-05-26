import { Home, Map, BookOpen, Briefcase, TrendingUp, User, type LucideIcon } from 'lucide-react';

export type AppNavItem = {
  path: string;
  icon: LucideIcon;
  label: string;
};

export const appNavItems: AppNavItem[] = [
  { path: '/app/dashboard', icon: Home, label: 'Home' },
  { path: '/app/roadmap', icon: Map, label: 'Roadmap' },
  { path: '/app/courses', icon: BookOpen, label: 'Courses' },
  { path: '/app/jobs', icon: Briefcase, label: 'Jobs' },
  { path: '/app/salary', icon: TrendingUp, label: 'Salary' },
  { path: '/app/profile', icon: User, label: 'Profile' },
];
