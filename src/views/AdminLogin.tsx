'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { Shield, Eye, EyeOff, Loader2 } from 'lucide-react';
import { BrandLogo } from '@/components/BrandLogo';
import { clearAppQueryCache } from '@/lib/query-client';

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;

    if (!email.trim() || !isValidEmail(email)) {
      setError('Enter a valid admin email.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setBusy(true);
    setError('');

    try {
      const ctxRes = await fetch('/api/v1/auth/login-context', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      const ctxJson = await ctxRes.json().catch(() => ({}));
      const portal = ctxJson?.data?.portal as string | null;

      if (portal === 'user') {
        setError('This account uses the user portal. Sign in at the main site.');
        return;
      }

      const res = await signIn('admin-credentials', {
        email: email.trim(),
        password,
        redirect: false,
      });

      if (res?.error) {
        setError('Invalid admin credentials or insufficient privileges.');
        return;
      }

      clearAppQueryCache();
      router.replace('/admin');
    } catch {
      setError('Could not reach the server. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="aurora-bg min-h-screen flex items-center justify-center p-4" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
      <div className="w-full max-w-md glass-card rounded-3xl p-8">
        <div className="flex flex-col items-center mb-8">
          <BrandLogo className="mb-4" />
          <div className="flex items-center gap-2 mb-2">
            <Shield size={22} color="#a78bfa" />
            <h1 style={{ color: 'var(--cp-text-primary)', fontWeight: 700, fontSize: '1.25rem' }}>
              Admin Sign In
            </h1>
          </div>
          <p style={{ color: 'var(--cp-text-muted)', fontSize: '0.85rem', textAlign: 'center' }}>
            ElevateX administration portal — authorized personnel only
          </p>
        </div>

        <form onSubmit={e => void handleSubmit(e)} className="space-y-4">
          {error && (
            <div
              className="rounded-xl px-3 py-2 text-sm"
              style={{ background: 'rgba(244,63,94,0.12)', border: '1px solid rgba(244,63,94,0.35)', color: '#fda4af' }}
              role="alert"
            >
              {error}
            </div>
          )}

          <div>
            <label style={{ color: 'var(--cp-text-muted)', fontSize: '0.8rem', display: 'block', marginBottom: '6px' }}>
              Admin email
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              autoComplete="username"
              className="w-full rounded-xl px-4 py-3 outline-none"
              style={{ background: 'var(--cp-bg-elevated)', border: '1px solid var(--cp-border)', color: 'var(--cp-text-primary)' }}
              placeholder="admin@elevatex.ai"
            />
          </div>

          <div>
            <label style={{ color: 'var(--cp-text-muted)', fontSize: '0.8rem', display: 'block', marginBottom: '6px' }}>
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="current-password"
                className="w-full rounded-xl px-4 py-3 pr-12 outline-none"
                style={{ background: 'var(--cp-bg-elevated)', border: '1px solid var(--cp-border)', color: 'var(--cp-text-primary)' }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                className="absolute right-3 top-1/3 -translate-y-1/2"
                style={{ background: 'none', border: 'none', color: 'var(--cp-text-muted)' }}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={busy}
            className="btn-primary w-full py-3 rounded-xl flex items-center justify-center gap-2"
            style={{ fontWeight: 700, opacity: busy ? 0.7 : 1 }}
          >
            {busy ? <Loader2 size={18} className="animate-spin" /> : null}
            Sign In
          </button>
        </form>

        <p className="mt-6 text-center text-xs" style={{ color: 'var(--cp-text-faint)' }}>
          No sign-up available. Contact platform owner for admin access.
        </p>
      </div>
    </div>
  );
}
