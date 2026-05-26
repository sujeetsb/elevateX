'use client';

import { useEffect, useState } from 'react';
import { CareerDialog } from '@/components/CareerDialog';
import { DialogTitle } from '@/components/ui/dialog';

export type AdminUserRow = {
  id: string;
  name: string | null;
  email: string | null;
  role: string;
  suspendedAt: string | null;
  deletedAt?: string | null;
  createdAt: string;
  profile: {
    currentRole: string | null;
    targetRole: string | null;
    subscriptionTier: string;
    onboardingComplete: boolean;
  } | null;
  resumes: Array<{ parseStatus: string; atsScore: number | null; title: string }>;
};

export type AdminUserDraft = {
  name: string;
  role: 'USER' | 'ADMIN';
  subscriptionTier: 'FREE' | 'PRO' | 'ENTERPRISE';
  currentRole: string;
  targetRole: string;
};

type Props = {
  user: AdminUserRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (id: string, draft: AdminUserDraft) => Promise<void>;
  saving: boolean;
};

export function AdminUserEditDialog({ user, open, onOpenChange, onSave, saving }: Props) {
  const [draft, setDraft] = useState<AdminUserDraft | null>(null);

  useEffect(() => {
    if (!user) {
      setDraft(null);
      return;
    }
    setDraft({
      name: user.name ?? '',
      role: user.role === 'ADMIN' ? 'ADMIN' : 'USER',
      subscriptionTier: (user.profile?.subscriptionTier ?? 'FREE') as AdminUserDraft['subscriptionTier'],
      currentRole: user.profile?.currentRole ?? '',
      targetRole: user.profile?.targetRole ?? '',
    });
  }, [user]);

  if (!user || !draft) return null;

  const dirty =
    draft.name !== (user.name ?? '') ||
    draft.role !== (user.role === 'ADMIN' ? 'ADMIN' : 'USER') ||
    draft.subscriptionTier !== (user.profile?.subscriptionTier ?? 'FREE') ||
    draft.currentRole !== (user.profile?.currentRole ?? '') ||
    draft.targetRole !== (user.profile?.targetRole ?? '');

  return (
    <CareerDialog open={open} onOpenChange={onOpenChange} preventClose={saving}>
      <DialogTitle className="sr-only">Edit user</DialogTitle>
      <div className="pr-8">
        <h3 style={{ color: 'var(--cp-text-primary)', fontWeight: 700, fontSize: '1.1rem', marginBottom: '4px' }}>
          Edit user
        </h3>
        <p style={{ color: 'var(--cp-text-muted)', fontSize: '0.8rem', marginBottom: '16px' }}>{user.email}</p>

        <div className="space-y-3">
          {[
            { label: 'Name', key: 'name' as const, type: 'text' },
            { label: 'Current role', key: 'currentRole' as const, type: 'text' },
            { label: 'Target role', key: 'targetRole' as const, type: 'text' },
          ].map(field => (
            <div key={field.key}>
              <label style={{ color: 'var(--cp-text-muted)', fontSize: '0.75rem', display: 'block', marginBottom: '4px' }}>
                {field.label}
              </label>
              <input
                value={draft[field.key]}
                onChange={e => setDraft(prev => (prev ? { ...prev, [field.key]: e.target.value } : prev))}
                className="w-full rounded-xl px-3 py-2 text-sm outline-none"
                style={{ background: 'var(--cp-bg-elevated)', border: '1px solid var(--cp-border)', color: 'var(--cp-text-primary)' }}
              />
            </div>
          ))}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label style={{ color: 'var(--cp-text-muted)', fontSize: '0.75rem', display: 'block', marginBottom: '4px' }}>
                Subscription
              </label>
              <select
                value={draft.subscriptionTier}
                onChange={e =>
                  setDraft(prev =>
                    prev ? { ...prev, subscriptionTier: e.target.value as AdminUserDraft['subscriptionTier'] } : prev,
                  )
                }
                className="w-full rounded-xl px-3 py-2 text-sm outline-none glass-card"
                style={{ color: 'var(--cp-text-primary)' }}
              >
                {['FREE', 'PRO', 'ENTERPRISE'].map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ color: 'var(--cp-text-muted)', fontSize: '0.75rem', display: 'block', marginBottom: '4px' }}>
                App role
              </label>
              <select
                value={draft.role}
                onChange={e =>
                  setDraft(prev => (prev ? { ...prev, role: e.target.value as AdminUserDraft['role'] } : prev))
                }
                className="w-full rounded-xl px-3 py-2 text-sm outline-none glass-card"
                style={{ color: 'var(--cp-text-primary)' }}
              >
                <option value="USER">USER</option>
                <option value="ADMIN">ADMIN</option>
              </select>
            </div>
          </div>
        </div>

        <div className="flex gap-2 mt-6">
          <button
            type="button"
            disabled={!dirty || saving}
            onClick={() => void onSave(user.id, draft)}
            className="btn-primary flex-1 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => onOpenChange(false)}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold glass-card"
            style={{ color: 'var(--cp-text-muted)' }}
          >
            Cancel
          </button>
        </div>
      </div>
    </CareerDialog>
  );
}
