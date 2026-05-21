'use client';

import { useState, type FormEvent } from 'react';
import { BrandLogo } from '@/components/BrandLogo';
import { APP_TAGLINE } from '@/lib/brand';
import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import { signIn } from 'next-auth/react';
import { Zap, ChevronRight, Eye, EyeOff, Loader2 } from 'lucide-react';

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function Landing() {
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
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
    if (!validate()) return;
    if (authBusy) return;
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
        router.push('/app/dashboard');
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
      router.push('/app/dashboard');
    } catch {
      setFormError('Could not reach the server. Try again.');
    } finally {
      setAuthBusy(false);
    }
  };

  const handleGoogleDemo = () => {
    if (authBusy) return;
    void signIn('google', { callbackUrl: '/app/dashboard' });
  };

  const features = [
    { icon: '🤖', title: 'AI Career Roadmap', desc: 'Personalized path to your dream role' },
    { icon: '📄', title: 'ATS Optimizer', desc: 'Beat applicant tracking systems' },
    { icon: '🎮', title: 'Gamified Learning', desc: 'Earn XP, badges & level up daily' },
    { icon: '💼', title: 'Smart Job Match', desc: 'AI-powered job recommendations' },
  ];

  return (
    <div className="aurora-bg min-h-screen flex items-center justify-center p-4 sm:p-6 lg:p-10" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
      <div className="w-full max-w-xl lg:max-w-2xl">
        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="flex flex-col items-center mb-8"
        >
          <BrandLogo size={64} nameClassName="text-2xl text-gradient" className="flex-col gap-3" />
          <p style={{ color: 'var(--cp-text-muted)', fontSize: '0.9rem', marginTop: '8px' }}>
            {APP_TAGLINE}
          </p>
        </motion.div>

        {/* Auth Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="glass-card rounded-3xl p-6 mb-6"
        >
          {/* Tab switcher */}
          <div className="flex rounded-2xl p-1 mb-6" style={{ background: 'var(--cp-bg-card)' }}>
            {(['login', 'signup'] as const).map(m => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setMode(m);
                  setFormError('');
                }}
                className="flex-1 py-2 rounded-xl transition-all duration-200 capitalize"
                style={{
                  background: mode === m ? 'rgba(124, 58, 237, 0.3)' : 'transparent',
                  color: mode === m ? 'var(--cp-accent-light)' : 'var(--cp-text-muted)',
                  fontWeight: mode === m ? 600 : 400,
                  fontSize: '0.9rem',
                  border: mode === m ? '1px solid rgba(124, 58, 237, 0.3)' : '1px solid transparent',
                }}
              >
                {m === 'login' ? 'Sign In' : 'Sign Up'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <div>
                <label htmlFor="signup-name" style={{ color: 'var(--cp-text-muted)', fontSize: '0.8rem', marginBottom: '6px', display: 'block' }}>Full Name</label>
                <input
                  id="signup-name"
                  type="text"
                  autoComplete="name"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  placeholder="Alex Chen"
                  className="w-full rounded-xl px-4 py-3 outline-none transition-all"
                  style={{
                    background: 'var(--cp-bg-elevated)',
                    border: '1px solid var(--cp-border)',
                    color: 'var(--cp-text-primary)',
                    fontSize: '0.9rem',
                  }}
                />
              </div>
            )}

            <div>
              <label htmlFor="auth-email" style={{ color: 'var(--cp-text-muted)', fontSize: '0.8rem', marginBottom: '6px', display: 'block' }}>Email</label>
              <input
                id="auth-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@email.com"
                className="w-full rounded-xl px-4 py-3 outline-none transition-all"
                style={{
                  background: 'var(--cp-bg-elevated)',
                  border: '1px solid var(--cp-border)',
                  color: 'var(--cp-text-primary)',
                  fontSize: '0.9rem',
                }}
              />
            </div>

            <div>
              <label htmlFor="auth-password" style={{ color: 'var(--cp-text-muted)', fontSize: '0.8rem', marginBottom: '6px', display: 'block' }}>Password</label>
              <div className="relative">
                <input
                  id="auth-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl px-4 py-3 outline-none transition-all pr-12"
                  style={{
                    background: 'var(--cp-bg-elevated)',
                    border: '1px solid var(--cp-border)',
                    color: 'var(--cp-text-primary)',
                    fontSize: '0.9rem',
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2"
                  style={{ color: 'var(--cp-text-muted)' }}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {formError ? (
              <p role="alert" style={{ color: '#f87171', fontSize: '0.82rem' }}>{formError}</p>
            ) : null}

            <motion.button
              type="submit"
              disabled={authBusy}
              whileTap={authBusy ? undefined : { scale: 0.97 }}
              className="btn-primary w-full py-3 rounded-xl mt-2 flex items-center justify-center gap-2 disabled:opacity-60 disabled:pointer-events-none"
              style={{ fontSize: '0.95rem', fontWeight: 600 }}
            >
              {authBusy ? <Loader2 className="animate-spin" size={20} aria-hidden /> : null}
              {authBusy ? 'Please wait…' : mode === 'login' ? 'Sign In & Level Up' : 'Start Your Journey'}
              {!authBusy ? <ChevronRight size={18} /> : null}
            </motion.button>
          </form>

          <div className="flex items-center gap-3 my-4">
            <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.1)' }} />
            <span style={{ color: 'var(--cp-text-faint)', fontSize: '0.8rem' }}>or</span>
            <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.1)' }} />
          </div>

          <button
            type="button"
            disabled={authBusy}
            onClick={handleGoogleDemo}
            className="w-full py-3 rounded-xl flex items-center justify-center gap-3 transition-all hover:opacity-90 disabled:opacity-50 disabled:pointer-events-none"
            style={{
              background: 'var(--cp-bg-elevated)',
              border: '1px solid var(--cp-border)',
              color: 'var(--cp-text-primary)',
              fontSize: '0.9rem',
            }}
          >
            <span>🌐</span>
            Continue with Google
          </button>
        </motion.div>

        {/* Features preview */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <p style={{ color: 'var(--cp-text-faint)', fontSize: '0.75rem', textAlign: 'center', marginBottom: '12px' }}>
            JOIN 50,000+ CAREER PILOTS
          </p>
          <div className="responsive-grid-2">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.3 + i * 0.05 }}
                className="glass-card rounded-2xl p-3"
              >
                <div className="text-xl mb-1">{f.icon}</div>
                <div style={{ color: 'var(--cp-text-primary)', fontSize: '0.8rem', fontWeight: 600 }}>{f.title}</div>
                <div style={{ color: 'var(--cp-text-muted)', fontSize: '0.72rem', marginTop: '2px' }}>{f.desc}</div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Stats row */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="flex justify-around mt-6 mb-4"
        >
          {[
            { value: '50K+', label: 'Users' },
            { value: '4.9★', label: 'Rating' },
            { value: '2.1M', label: 'XP Earned' },
          ].map(s => (
            <div key={s.label} className="text-center">
              <div className="text-gradient" style={{ fontWeight: 700, fontSize: '1.1rem' }}>{s.value}</div>
              <div style={{ color: 'var(--cp-text-faint)', fontSize: '0.72rem' }}>{s.label}</div>
            </div>
          ))}
        </motion.div>
      </div>
    </div>
  );
}
