'use client';

import { Loader2, RefreshCw, AlertCircle, Inbox } from 'lucide-react';

type AsyncStateProps = {
  loading?: boolean;
  error?: string | null;
  empty?: boolean;
  emptyMessage?: string;
  onRetry?: () => void;
  children: React.ReactNode;
  skeleton?: React.ReactNode;
};

export function AsyncState({
  loading,
  error,
  empty,
  emptyMessage = 'Nothing here yet.',
  onRetry,
  children,
  skeleton,
}: AsyncStateProps) {
  if (loading) {
    if (skeleton) return <>{skeleton}</>;
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3">
        <Loader2 className="animate-spin text-violet-400" size={28} />
        <p style={{ color: 'var(--cp-text-muted)', fontSize: '0.85rem' }}>Loading…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="rounded-2xl p-6 text-center glass-card"
        style={{ border: '1px solid rgba(244,63,94,0.3)' }}
        role="alert"
      >
        <AlertCircle size={28} color="#f87171" className="mx-auto mb-3" />
        <p style={{ color: '#fda4af', fontSize: '0.9rem', marginBottom: '12px' }}>{error}</p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold"
            style={{ background: 'rgba(124,58,237,0.2)', color: '#a78bfa', border: '1px solid rgba(124,58,237,0.3)' }}
          >
            <RefreshCw size={14} />
            Retry
          </button>
        )}
      </div>
    );
  }

  if (empty) {
    return (
      <div className="rounded-2xl p-8 text-center glass-card" style={{ border: '1px dashed rgba(255,255,255,0.12)' }}>
        <Inbox size={32} color="#64748b" className="mx-auto mb-3" />
        <p style={{ color: 'var(--cp-text-muted)', fontSize: '0.9rem' }}>{emptyMessage}</p>
      </div>
    );
  }

  return <>{children}</>;
}
