'use client';

import { SubscriptionUpgradeModal } from '@/components/SubscriptionUpgradeModal';
import { CareerDialog } from '@/components/CareerDialog';
import { DialogTitle } from '@/components/ui/dialog';
import { Zap } from 'lucide-react';
import { useState } from 'react';

type ProUpgradeModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  feature?: string;
};

export function ProUpgradeModal({ open, onOpenChange, feature = 'this feature' }: ProUpgradeModalProps) {
  const [showSubscribe, setShowSubscribe] = useState(false);

  return (
    <>
      <CareerDialog open={open && !showSubscribe} onOpenChange={onOpenChange}>
        <DialogTitle className="sr-only">Upgrade to PRO</DialogTitle>
        <div className="text-center py-2">
          <div className="text-4xl mb-3">✨</div>
          <h3 style={{ color: 'var(--cp-text-primary)', fontWeight: 700, fontSize: '1.15rem', marginBottom: '8px' }}>
            PRO required
          </h3>
          <p style={{ color: 'var(--cp-text-muted)', fontSize: '0.85rem', marginBottom: '20px' }}>
            {feature} is available on the PRO plan. Upgrade to unlock job applications, cover letters, job-tailored resume optimization, and premium insights.
          </p>
          <button
            type="button"
            onClick={() => {
              onOpenChange(false);
              setShowSubscribe(true);
            }}
            className="btn-primary w-full py-3 rounded-xl flex items-center justify-center gap-2 mb-2"
            style={{ fontWeight: 600 }}
          >
            <Zap size={16} />
            Subscribe to PRO
          </button>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="w-full py-2 text-sm"
            style={{ color: 'var(--cp-text-muted)', background: 'none', border: 'none' }}
          >
            Maybe later
          </button>
        </div>
      </CareerDialog>
      <SubscriptionUpgradeModal open={showSubscribe} onOpenChange={setShowSubscribe} />
    </>
  );
}
