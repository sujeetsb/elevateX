'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { ChevronRight, Eye, EyeOff, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

type AuthMode = 'login' | 'signup';

interface LandingAuthDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: AuthMode;
  onModeChange: (mode: AuthMode) => void;
}

export function LandingAuthDialog({ open, onOpenChange, mode, onModeChange }: LandingAuthDialogProps) {
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

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validate() || authBusy) return;
    setAuthBusy(true);
    setFormError('');
    try {
      if (mode === 'signup') {
        const res = await fetch('/api/v1/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email.trim(), password, name: fullName.trim() }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          setFormError((json as { message?: string })?.message || 'Could not create account');
          return;
        }
        const signInRes = await signIn('credentials', {
          email: email.trim(),
          password,
          redirect: false,
        });
        if (signInRes?.error) {
          setFormError('Sign-in failed. Try logging in instead.');
          return;
        }
        onOpenChange(false);
        router.push('/onboarding');
        return;
      }

      const ctxRes = await fetch('/api/v1/auth/login-context', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      const ctxJson = await ctxRes.json().catch(() => ({}));
      if (ctxJson?.data?.portal === 'admin') {
        setFormError('Admin accounts must use the admin portal at /admin/login');
        return;
      }

      const signInRes = await signIn('credentials', {
        email: email.trim(),
        password,
        redirect: false,
      });
      if (signInRes?.error) {
        setFormError('Invalid email or password');
        return;
      }
      onOpenChange(false);
      router.push('/app/dashboard');
    } catch {
      setFormError('Could not reach the server. Try again.');
    } finally {
      setAuthBusy(false);
    }
  };

  const handleGoogle = () => {
    if (authBusy) return;
    void signIn('google', { callbackUrl: '/app/dashboard' });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md border-[var(--cp-border-strong)] bg-[var(--modal)] shadow-[var(--cp-elevation-4)]">
        <DialogHeader>
          <DialogTitle className="text-[var(--cp-text-primary)]">
            {mode === 'login' ? 'Welcome back' : 'Create your account'}
          </DialogTitle>
          <DialogDescription className="text-[var(--cp-text-muted)]">
            {mode === 'login'
              ? 'Sign in to continue your career journey.'
              : 'Start analyzing your resume and building your AI roadmap.'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex rounded-[var(--cp-radius-lg)] p-1 mb-4 bg-[var(--cp-surface-1)] border border-[var(--cp-border-subtle)]">
          {(['login', 'signup'] as const).map(m => (
            <button
              key={m}
              type="button"
              onClick={() => {
                onModeChange(m);
                setFormError('');
              }}
              className="flex-1 py-2 rounded-[var(--cp-radius-md)] transition-all duration-150 capitalize text-sm"
              style={{
                background: mode === m ? 'var(--cp-accent-bg)' : 'transparent',
                color: mode === m ? 'var(--cp-accent-light)' : 'var(--cp-text-muted)',
                fontWeight: mode === m ? 600 : 400,
                border: mode === m ? '1px solid var(--cp-border-accent)' : '1px solid transparent',
              }}
            >
              {m === 'login' ? 'Sign In' : 'Sign Up'}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'signup' && (
            <div>
              <label htmlFor="landing-name" className="cp-label block mb-1.5 normal-case">Full Name</label>
              <input
                id="landing-name"
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
            <label htmlFor="landing-email" className="cp-label block mb-1.5 normal-case">Email</label>
            <input
              id="landing-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@email.com"
              className="cp-input"
            />
          </div>

          <div>
            <label htmlFor="landing-password" className="cp-label block mb-1.5 normal-case">Password</label>
            <div className="relative">
              <input
                id="landing-password"
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
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--cp-text-muted)]"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {formError ? (
            <p role="alert" className="text-sm" style={{ color: 'var(--cp-danger)' }}>{formError}</p>
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

        <div className="flex items-center gap-3 my-2">
          <div className="flex-1 h-px bg-[var(--cp-border)]" />
          <span className="text-xs text-[var(--cp-text-faint)]">or</span>
          <div className="flex-1 h-px bg-[var(--cp-border)]" />
        </div>

        <button
          type="button"
          disabled={authBusy}
          onClick={handleGoogle}
          className="btn-ghost w-full py-3 flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <span aria-hidden>🌐</span>
          Continue with Google
        </button>
      </DialogContent>
    </Dialog>
  );
}
