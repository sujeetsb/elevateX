'use client';

/**
 * ThemeContext — single source of truth for dark / light / system preference.
 *
 * Intentionally has NO dependency on GameContext / auth. This lets the theme
 * apply instantly on every page (including unauthenticated routes) without
 * waiting for session hydration.
 *
 * Priority order (highest → lowest):
 *   1. User's explicit choice (persisted to localStorage + DB)
 *   2. Server-saved preference fetched after auth hydrates
 *   3. OS / system preference
 *   4. Dark (hard default)
 *
 * The root layout injects a blocking <script> that reads localStorage and sets
 * data-theme on <html> before React hydrates, so there is never a flash.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';

export type ThemeMode = 'dark' | 'light' | 'system';

interface ThemeContextType {
  /** The user-selected mode (may be 'system'). */
  theme: ThemeMode;
  /** The actual resolved theme applied to the DOM ('dark' or 'light'). */
  resolvedTheme: 'dark' | 'light';
  setTheme: (theme: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

const STORAGE_KEY = 'cp-theme';

function getSystemTheme(): 'dark' | 'light' {
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function resolveMode(mode: ThemeMode): 'dark' | 'light' {
  return mode === 'system' ? getSystemTheme() : mode;
}

function applyThemeToDom(resolved: 'dark' | 'light') {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-theme', resolved);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Start with 'dark' to match the blocking script default, avoiding hydration mismatch.
  const [theme, setThemeState] = useState<ThemeMode>('dark');
  const [resolvedTheme, setResolvedTheme] = useState<'dark' | 'light'>('dark');
  const serverSynced = useRef(false);

  // On mount: read from localStorage (the blocking script already applied it
  // to the DOM, but we need React state to catch up without a double-apply).
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as ThemeMode | null;
      if (stored && (['dark', 'light', 'system'] as const).includes(stored)) {
        const resolved = resolveMode(stored);
        setThemeState(stored);
        setResolvedTheme(resolved);
        applyThemeToDom(resolved); // ensure DOM matches (blocking script may have run before this)
      }
    } catch {
      // localStorage blocked (private browsing, etc.) — keep default dark
    }
  }, []);

  // Sync from server after user is authenticated. We do a lightweight GET
  // to /api/v1/me only once, so this provider stays decoupled from GameContext.
  useEffect(() => {
    if (serverSynced.current) return;
    serverSynced.current = true;

    fetch('/api/v1/me', { credentials: 'include' })
      .then(r => (r.ok ? r.json() : null))
      .then((data: { profile?: { themePreference?: string } } | null) => {
        const serverPref = data?.profile?.themePreference as ThemeMode | undefined;
        if (!serverPref || !(['dark', 'light', 'system'] as const).includes(serverPref)) return;

        // Server wins only if user hasn't made an explicit local choice this session
        const local = localStorage.getItem(STORAGE_KEY);
        if (!local) {
          const resolved = resolveMode(serverPref);
          setThemeState(serverPref);
          setResolvedTheme(resolved);
          applyThemeToDom(resolved);
          localStorage.setItem(STORAGE_KEY, serverPref);
        }
      })
      .catch(() => undefined);
  }, []);

  // React to OS-level changes when mode is 'system'
  useEffect(() => {
    if (theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      const resolved = getSystemTheme();
      setResolvedTheme(resolved);
      applyThemeToDom(resolved);
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [theme]);

  const setTheme = useCallback((mode: ThemeMode) => {
    const resolved = resolveMode(mode);
    setThemeState(mode);
    setResolvedTheme(resolved);
    applyThemeToDom(resolved);

    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      // ignore
    }

    // Persist to server — fire-and-forget, no await
    void fetch('/api/v1/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ themePreference: mode }),
      credentials: 'include',
    }).catch(() => undefined);
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
