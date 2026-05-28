'use client';

import { Zap } from 'lucide-react';
import { XP_EARN_SUGGESTIONS } from '@/lib/gamification/xp-costs';

type LowXpAlertProps = {
  required?: number;
  balance?: number;
  suggestions?: string[];
  className?: string;
};

export function LowXpAlert({ required, balance, suggestions, className = '' }: LowXpAlertProps) {
  const tips = suggestions?.length ? suggestions : XP_EARN_SUGGESTIONS;

  return (
    <div
      className={`rounded-2xl p-4 ${className}`}
      style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)' }}
      role="alert"
    >
      <div className="flex items-center gap-2 mb-2">
        <Zap size={16} color="#f59e0b" />
        <span style={{ color: '#f59e0b', fontWeight: 700, fontSize: '0.85rem' }}>Not enough XP</span>
      </div>
      {typeof required === 'number' && typeof balance === 'number' && (
        <p style={{ color: 'var(--cp-text-muted)', fontSize: '0.78rem', marginBottom: '8px' }}>
          You need {required} XP but have {balance} XP.
        </p>
      )}
      <p style={{ color: 'var(--cp-text-muted)', fontSize: '0.75rem', marginBottom: '6px' }}>Earn more XP by:</p>
      <ul className="space-y-1 pl-4 list-disc">
        {tips.slice(0, 4).map(tip => (
          <li key={tip} style={{ color: 'var(--cp-text-muted)', fontSize: '0.72rem' }}>{tip}</li>
        ))}
      </ul>
    </div>
  );
}
