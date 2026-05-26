'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { signIn } from 'next-auth/react';
import { ChevronRight, Eye, EyeOff, Loader2 } from 'lucide-react';
import { BrandLogo } from '@/components/BrandLogo';

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

type AuthMode = 'login' | 'signup';

type Props = {
  mode: AuthMode;
  alternateHref: string;
  alternateLabel: string;
};

export function UserAuthPage({ mode, alternateHref, alternateLabel }: Props) {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [formError, setFormError] = useState('');
  const [authBusy, setAuthBusy] = useState(false);

  const validate = (): boolean => {
    if (!email.trim()) {
      setFormError('Please enter your email.');
      return false;
    }
    if (!isValidEmail(email)) {
      setFormError('Please enter a valid email address.');
      return false;
    }
    if (password.length < 8) {
      setFormError('Password must be at least 8 characters.');
      return false;
    }
    if (mode === 'signup' && !fullName.trim()) {
      setFormError('Please enter your full name.');
      return false;
    }
    setFormError('');
    return true;
  };

  const checkUserPortal = async (trimmedEmail: string): Promise<boolean> => {
    const ctxRes = await fetch('/api/v1/auth/login-context', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: trimmedEmail }),
    });
    const ctxJson = await ctxRes.json().catch(() => ({}));
    const portal = ctxJson?.data?.portal as string | null;
    if (portal === 'admin') {
      setFormError('Admin accounts must sign in at the admin portal.');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validate() || authBusy) return;
    setAuthBusy(true);
    setFormError('');
    const trimmedEmail = email.trim();

    try {
      if (!(await checkUserPortal(trimmedEmail))) return;

      if (mode === 'signup') {
        const res = await fetch('/api/v1/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: trimmedEmail, password, name: fullName.trim() }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          setFormError((json as { message?: string })?.message || 'Could not create account');
          return;
        }
      }

      const signInRes = await signIn('credentials', {
        email: trimmedEmail,
        password,
        redirect: false,
      });
      if (signInRes?.error) {
        setFormError(mode === 'login' ? 'Invalid email or password' : 'Sign-in failed after registration.');
        return;
      }
      router.replace(mode === 'signup' ? '/onboarding' : '/app/dashboard');
    } catch {
      setFormError('Could not reach the server. Try again.');
    } finally {
      setAuthBusy(false);
    }
  };

  const handleGoogle = async () => {
    if (authBusy) return;
    if (email.trim() && isValidEmail(email)) {
      const ok = await checkUserPortal(email.trim());
      if (!ok) return;
    }
    void signIn('google', { callbackUrl: '/app/dashboard' });
  };

  return (
    <div className="aurora-bg min-h-screen flex items-center justify-center p-4" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
      <div className="w-full max-w-md glass-card rounded-3xl p-8">
        <div className="flex flex-col items-center mb-8">
          <BrandLogo className="mb-4" />
          <h1 style={{ color: 'var(--cp-text-primary)', fontWeight: 700, fontSize: '1.25rem' }}>
            {mode === 'login' ? 'Welcome back' : 'Create your account'}
          </h1>
          <p style={{ color: 'var(--cp-text-muted)', fontSize: '0.85rem', textAlign: 'center', marginTop: '6px' }}>
            {mode === 'login'
              ? 'Sign in to continue your career journey.'
              : 'Start analyzing your resume and building your AI roadmap.'}
          </p>
        </div>

        <form onSubmit={e => void handleSubmit(e)} className="space-y-4">
          {mode === 'signup' && (
            <div>
              <label htmlFor="auth-name" className="cp-label block mb-1.5 normal-case">Full Name</label>
              <input
                id="auth-name"
                type="text"
                autoComplete="name"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                placeholder="Alex Chen"
                className="cp-input"
              />
            </div>
          )}

          <div>
            <label htmlFor="auth-email" className="cp-label block mb-1.5 normal-case">Email</label>
            <input
              id="auth-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@email.com"
              className="cp-input"
            />
          </div>

          <div>
            <label htmlFor="auth-password" className="cp-label block mb-1.5 normal-case">Password</label>
            <div className="relative">
              <input
                id="auth-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="cp-input pr-12"
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                className="absolute right-3 top-1/3 -translate-y-1/2 text-[var(--cp-text-muted)]"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {formError ? (
            <p role="alert" className="text-sm" style={{ color: 'var(--cp-danger)' }}>
              {formError}
              {formError.includes('admin portal') ? (
                <>
                  {' '}
                  <Link href="/admin/login" className="underline" style={{ color: 'var(--cp-accent-light)' }}>
                    Go to admin login
                  </Link>
                </>
              ) : null}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={authBusy}
            className="btn-primary w-full py-3 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {authBusy ? <Loader2 className="animate-spin" size={18} aria-hidden /> : null}
            {authBusy ? 'Please wait…' : mode === 'login' ? 'Sign In' : 'Get Started'}
            {!authBusy ? <ChevronRight size={18} /> : null}
          </button>
        </form>

        <div className="flex items-center gap-3 my-4">
          <div className="flex-1 h-px bg-[var(--cp-border)]" />
          <span className="text-xs text-[var(--cp-text-faint)]">or</span>
          <div className="flex-1 h-px bg-[var(--cp-border)]" />
        </div>

        <button
          type="button"
          disabled={authBusy}
          onClick={() => void handleGoogle()}
          className="btn-ghost w-full py-3 flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <span aria-hidden>🌐</span>
          Continue with Google
        </button>

        <p className="mt-6 text-center text-sm" style={{ color: 'var(--cp-text-muted)' }}>
          {alternateLabel}{' '}
          <Link href={alternateHref} className="font-semibold" style={{ color: 'var(--cp-accent-light)' }}>
            {mode === 'login' ? 'Sign up' : 'Sign in'}
          </Link>
        </p>
      </div>
    </div>
  );
}
