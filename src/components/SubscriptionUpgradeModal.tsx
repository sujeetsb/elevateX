'use client';

import { useState } from 'react';
import { motion } from 'motion/react';
import { Zap, Check, Crown } from 'lucide-react';
import { CareerDialog } from '@/components/CareerDialog';
import { DialogTitle } from '@/components/ui/dialog';
import { useGame } from '@/components/GameContext';
import { isProTierClient } from '@/lib/subscription/tier';
import { toast } from 'sonner';

type Tier = 'FREE' | 'PRO';

type SubscriptionUpgradeModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function SubscriptionUpgradeModal({ open, onOpenChange }: SubscriptionUpgradeModalProps) {
  const { user, refresh } = useGame();
  const current = (user.subscriptionTier?.toUpperCase() === 'PRO' ? 'PRO' : 'FREE') as Tier;
  const [selected, setSelected] = useState<Tier>(current);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/v1/subscription', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ tier: selected }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message ?? 'Could not update subscription');
      await refresh();
      setSuccess(true);
      toast.success(selected === 'PRO' ? 'Welcome to PRO!' : 'Plan updated to FREE');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  const handleClose = (v: boolean) => {
    if (!v) {
      setSuccess(false);
      setSelected(current);
    }
    onOpenChange(v);
  };

  return (
    <CareerDialog open={open} onOpenChange={handleClose}>
      <DialogTitle className="sr-only">Manage subscription</DialogTitle>
      {success ? (
        <div className="text-center py-4">
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="text-5xl mb-4">
            {selected === 'PRO' ? '👑' : '✓'}
          </motion.div>
          <h3 style={{ color: 'var(--cp-text-primary)', fontWeight: 700, fontSize: '1.2rem', marginBottom: '8px' }}>
            {selected === 'PRO' ? 'You\'re on PRO!' : 'Plan updated'}
          </h3>
          <p style={{ color: 'var(--cp-text-muted)', fontSize: '0.85rem', marginBottom: '20px' }}>
            {selected === 'PRO'
              ? 'Job applications, cover letters, job-tailored resume optimization, and premium insights are now unlocked.'
              : 'You\'re on the FREE plan. Upgrade anytime to unlock PRO features.'}
          </p>
          <button type="button" onClick={() => handleClose(false)} className="btn-primary w-full py-3 rounded-xl" style={{ fontWeight: 600 }}>
            Continue
          </button>
        </div>
      ) : (
        <div>
          <div className="text-center mb-5">
            <Crown size={28} color="#a78bfa" className="mx-auto mb-2" />
            <h3 style={{ color: 'var(--cp-text-primary)', fontWeight: 700, fontSize: '1.15rem' }}>Choose your plan</h3>
            <p style={{ color: 'var(--cp-text-muted)', fontSize: '0.82rem' }}>
              Current: <strong>{isProTierClient(user.subscriptionTier) ? 'PRO' : 'FREE'}</strong> — no payment required in demo
            </p>
          </div>

          <div className="space-y-3 mb-5">
            {(['FREE', 'PRO'] as Tier[]).map(tier => (
              <button
                key={tier}
                type="button"
                onClick={() => setSelected(tier)}
                className="w-full text-left rounded-2xl p-4 transition-all"
                style={{
                  background: selected === tier ? 'rgba(124,58,237,0.15)' : 'var(--cp-bg-elevated)',
                  border: selected === tier ? '1px solid rgba(124,58,237,0.45)' : '1px solid var(--cp-border)',
                }}
              >
                <div className="flex items-center justify-between mb-2">
                  <span style={{ color: 'var(--cp-text-primary)', fontWeight: 700 }}>{tier}</span>
                  {selected === tier && <Check size={18} color="#a78bfa" />}
                </div>
                <ul className="space-y-1">
                  {(tier === 'FREE'
                    ? ['Basic courses & dashboard', 'Salary insights (summary)', 'Resume upload']
                    : ['Job apply & cover letters', 'Job-tailored resume AI', 'Premium salary charts', 'Unlimited AI courses']
                  ).map(f => (
                    <li key={f} style={{ color: 'var(--cp-text-muted)', fontSize: '0.75rem' }}>• {f}</li>
                  ))}
                </ul>
              </button>
            ))}
          </div>

          <button
            type="button"
            disabled={saving || selected === current}
            onClick={() => void handleSave()}
            className="btn-primary w-full py-3 rounded-xl flex items-center justify-center gap-2"
            style={{ fontWeight: 600, opacity: saving || selected === current ? 0.6 : 1 }}
          >
            <Zap size={16} />
            {selected === current ? 'Current plan' : selected === 'PRO' ? 'Subscribe to PRO' : 'Downgrade to FREE'}
          </button>
        </div>
      )}
    </CareerDialog>
  );
}
