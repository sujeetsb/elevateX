'use client';

import { useRouter, usePathname } from 'next/navigation';
import { motion } from 'motion/react';
import { Zap, Moon, Sun, Monitor } from 'lucide-react';
import { useGame } from './GameContext';
import { useTheme } from './ThemeContext';
import { BrandLogo } from './BrandLogo';
import { appNavItems } from '@/lib/navigation/app-nav';

export function Sidebar() {
  const router = useRouter();
  const pathname = usePathname() ?? '';
  const { user, xp, level, levelName } = useGame();
  const { theme, setTheme } = useTheme();

  return (
    <aside
      className="sidebar-desktop flex-col fixed left-0 top-0 h-full z-40 bg-sidebar border-r border-sidebar-border"
      style={{ width: '240px', fontFamily: "'Space Grotesk', sans-serif" }}
      aria-label="Sidebar navigation"
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-sidebar-border">
        <BrandLogo size={36} nameClassName="text-[1.05rem] text-sidebar-foreground" />
      </div>

      {/* Nav items */}
      <nav className="flex-1 px-3 py-4 space-y-0.5" aria-label="Primary">
        {appNavItems.map(({ path, icon: Icon, label }) => {
          const isActive = pathname === path || pathname.startsWith(`${path}/`);
          return (
            <button
              key={path}
              type="button"
              onClick={() => router.push(path)}
              onMouseEnter={() => router.prefetch(path)}
              onFocus={() => router.prefetch(path)}
              aria-current={isActive ? 'page' : undefined}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-[var(--cp-radius-md)] transition-colors duration-150 relative group"
              style={{
                color: isActive ? 'var(--sidebar-accent-foreground)' : 'var(--cp-text-muted)',
              }}
            >
              {isActive && (
                <motion.div
                  layoutId="sidebar-indicator"
                  className="absolute inset-0 rounded-[var(--cp-radius-md)] bg-sidebar-accent border border-[var(--cp-border-accent)]"
                />
              )}
              {!isActive && (
                <div className="absolute inset-0 rounded-[var(--cp-radius-md)] opacity-0 group-hover:opacity-100 bg-[var(--cp-bg-hover)] transition-opacity duration-150" />
              )}
              <Icon size={18} strokeWidth={isActive ? 2.25 : 1.75} className="relative z-10 shrink-0" />
              <span
                className="relative z-10 text-[0.875rem]"
                style={{ fontWeight: isActive ? 600 : 450 }}
              >
                {label}
              </span>
            </button>
          );
        })}
      </nav>

      {/* AI Mentor CTA */}
      <div className="px-3 pb-3">
        <button
          type="button"
          onClick={() => router.push('/app/mentor')}
          className="w-full flex items-center gap-3 px-3 py-3 rounded-[var(--cp-radius-md)] transition-colors duration-150 bg-sidebar-accent border border-[var(--cp-border-accent)] hover:bg-[var(--cp-accent-muted)]"
          aria-label="Open AI Mentor"
        >
          <span className="text-lg">🤖</span>
          <div className="flex-1 text-left">
            <div className="text-sidebar-accent-foreground font-medium text-[0.8125rem]">
              AI Mentor
            </div>
            <div className="text-[var(--cp-text-faint)] text-[0.6875rem]">Ask anything</div>
          </div>
        </button>
      </div>

      {/* Theme toggle */}
      <div className="px-3 pb-2">
        <div className="rounded-[var(--cp-radius-md)] p-2 bg-[var(--cp-surface-2)] border border-[var(--cp-border-subtle)] shadow-[var(--cp-elevation-1)]">
          <div className="text-[var(--cp-text-faint)] text-[0.6875rem] mb-1.5 pl-1 uppercase tracking-wide">
            Theme
          </div>
          <div className="flex gap-1">
            {(
              [
                { mode: 'dark' as const, icon: <Moon size={13} />, label: 'Dark' },
                { mode: 'light' as const, icon: <Sun size={13} />, label: 'Light' },
                { mode: 'system' as const, icon: <Monitor size={13} />, label: 'Auto' },
              ] as const
            ).map(({ mode, icon, label }) => (
              <button
                key={mode}
                type="button"
                onClick={() => setTheme(mode)}
                className="flex-1 flex items-center justify-center gap-1 rounded-[var(--cp-radius-sm)] py-1.5 transition-colors duration-150 text-[0.6875rem]"
                style={{
                  background: theme === mode ? 'var(--cp-accent-bg)' : 'transparent',
                  border: theme === mode ? '1px solid var(--cp-border-accent)' : '1px solid transparent',
                  color: theme === mode ? 'var(--cp-accent-light)' : 'var(--cp-text-faint)',
                }}
              >
                {icon}
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* User info */}
      <div className="px-4 py-4 border-t border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-[var(--cp-radius-md)] flex items-center justify-center shrink-0 bg-primary text-primary-foreground font-semibold text-sm">
            {user.name.charAt(0)?.toUpperCase() || '?'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[var(--cp-text-primary)] font-medium text-[0.8125rem] truncate">
              {user.name || 'Your Name'}
            </div>
            <div className="text-[var(--cp-text-faint)] text-[0.6875rem]">
              Lv {level} · {levelName}
            </div>
          </div>
          <div className="flex items-center gap-1 text-[var(--cp-warning)]">
            <Zap size={13} />
            <span className="text-[0.8125rem] font-semibold tabular-nums">{xp}</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
