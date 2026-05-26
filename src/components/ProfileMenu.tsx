'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { User, Moon, Sun, Monitor, LogOut, Settings } from 'lucide-react';
import { useGame } from './GameContext';
import { useTheme } from './ThemeContext';

interface ProfileMenuProps {
  onNavigate?: (path: string) => void;
  onSignOut?: () => void;
}

export function ProfileMenuDropdown({ onNavigate, onSignOut }: ProfileMenuProps) {
  const { user, signOut } = useGame();
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const menuItems = [
    {
      icon: <User size={15} />,
      label: 'Account',
      sublabel: user.email,
      action: () => {
        onNavigate?.('/app/profile');
        setOpen(false);
      },
    },
  ];

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-9 h-9 rounded-xl flex items-center justify-center glass-card transition-all"
        style={{
          border: open ? '1px solid var(--cp-border-accent)' : '1px solid var(--cp-border)',
        }}
        aria-label="Settings menu"
        aria-expanded={open}
      >
        <Settings
          size={18}
          style={{ color: open ? 'var(--cp-accent-light)' : 'var(--cp-text-muted)' }}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: -8 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="absolute right-0 top-11 z-50 w-60 rounded-2xl overflow-hidden shadow-2xl"
            style={{
              background: 'var(--cp-bg-card-solid)',
              border: '1px solid var(--cp-border)',
            }}
          >
            {/* User info header */}
            <div
              className="px-4 py-3"
              style={{ borderBottom: '1px solid var(--cp-border)' }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: 'linear-gradient(135deg, #7c3aed, #06b6d4)' }}
                >
                  <span style={{ color: 'white', fontWeight: 800, fontSize: '1rem' }}>
                    {user.name.charAt(0) || '?'}
                  </span>
                </div>
                <div className="min-w-0">
                  <div
                    style={{ color: 'var(--cp-text-primary)', fontWeight: 600, fontSize: '0.85rem' }}
                    className="truncate"
                  >
                    {user.name || 'Your Account'}
                  </div>
                  <div
                    style={{ color: 'var(--cp-text-faint)', fontSize: '0.72rem' }}
                    className="truncate"
                  >
                    {user.email}
                  </div>
                </div>
              </div>
            </div>

            {/* Menu items */}
            <div className="py-1">
              {menuItems.map(item => (
                <button
                  key={item.label}
                  type="button"
                  onClick={item.action}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-all"
                  style={{ background: 'transparent' }}
                  onMouseEnter={e =>
                    ((e.currentTarget as HTMLElement).style.background = 'var(--cp-bg-hover)')
                  }
                  onMouseLeave={e =>
                    ((e.currentTarget as HTMLElement).style.background = 'transparent')
                  }
                >
                  <span style={{ color: 'var(--cp-text-muted)' }}>{item.icon}</span>
                  <div className="min-w-0 flex-1">
                    <div
                      style={{
                        color: 'var(--cp-text-primary)',
                        fontSize: '0.85rem',
                        fontWeight: 500,
                      }}
                    >
                      {item.label}
                    </div>
                    {item.sublabel && (
                      <div
                        style={{ color: 'var(--cp-text-faint)', fontSize: '0.72rem' }}
                        className="truncate"
                      >
                        {item.sublabel}
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>

            {/* Theme switcher */}
            <div
              className="px-4 py-2.5"
              style={{
                borderTop: '1px solid var(--cp-border)',
                borderBottom: '1px solid var(--cp-border)',
              }}
            >
              <div
                style={{
                  color: 'var(--cp-text-faint)',
                  fontSize: '0.72rem',
                  marginBottom: '6px',
                }}
              >
                Theme
              </div>
              <div className="flex gap-1.5">
                {(
                  [
                    { mode: 'dark' as const, icon: <Moon size={12} />, label: 'Dark' },
                    { mode: 'light' as const, icon: <Sun size={12} />, label: 'Light' },
                    { mode: 'system' as const, icon: <Monitor size={12} />, label: 'Auto' },
                  ] as const
                ).map(({ mode, icon, label }) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setTheme(mode)}
                    className="flex-1 flex items-center justify-center gap-1 rounded-lg py-1.5 transition-all"
                    style={{
                      background:
                        theme === mode ? 'var(--cp-accent-bg)' : 'var(--cp-bg-elevated)',
                      border:
                        theme === mode
                          ? '1px solid var(--cp-border-accent)'
                          : '1px solid var(--cp-border)',
                      color:
                        theme === mode ? 'var(--cp-accent-light)' : 'var(--cp-text-muted)',
                      fontSize: '0.7rem',
                    }}
                  >
                    {icon}
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Logout */}
            <div className="py-1">
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  if (onSignOut) onSignOut();
                  else void signOut();
                }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-all"
                style={{ background: 'transparent' }}
                onMouseEnter={e =>
                  ((e.currentTarget as HTMLElement).style.background =
                    'rgba(239,68,68,0.08)')
                }
                onMouseLeave={e =>
                  ((e.currentTarget as HTMLElement).style.background = 'transparent')
                }
              >
                <LogOut size={15} style={{ color: 'var(--cp-danger)' }} />
                <span
                  style={{ color: 'var(--cp-danger)', fontSize: '0.85rem', fontWeight: 500 }}
                >
                  Sign out
                </span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
