'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Loader2, Search, Trash2, UserX, UserCheck, Pencil, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { isSuperAdminRole } from '@/lib/auth/roles';
import { AsyncState } from '@/components/AsyncState';
import { AdminUserEditDialog, type AdminUserRow, type AdminUserDraft } from '@/components/admin/AdminUserEditDialog';
import { CareerDialog } from '@/components/CareerDialog';
import { DialogTitle } from '@/components/ui/dialog';

type AdminMeta = {
  page: number;
  total: number;
  pages: number;
  stats?: { courses: number; jobs: number; proSubscribers: number; estimatedRevenue: number };
};

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString();
  } catch {
    return '—';
  }
}

export default function AdminPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [meta, setMeta] = useState<AdminMeta | null>(null);
  const [q, setQ] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);
  const [editUser, setEditUser] = useState<AdminUserRow | null>(null);
  const [viewUser, setViewUser] = useState<AdminUserRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{
    type: 'suspend' | 'delete' | 'restore';
    user: AdminUserRow;
  } | null>(null);

  useEffect(() => {
    if (status === 'loading') return;
    if (!session?.user || !isSuperAdminRole(session.user.role)) {
      router.replace('/admin/login');
      return;
    }
    void loadUsers(searchQuery, page);
  }, [status, session, router, page, searchQuery]);

  async function loadUsers(query: string, p: number) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/users?q=${encodeURIComponent(query)}&page=${p}&limit=20`,
        { credentials: 'include' },
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message ?? 'Failed to load users');
      setUsers(json.data ?? []);
      setMeta(json.meta ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }

  async function patchUser(id: string, body: Record<string, unknown>) {
    setActionId(id);
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.message ?? 'Update failed');
      toast.success('User updated successfully');
      await loadUsers(searchQuery, page);
      return true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Update failed');
      return false;
    } finally {
      setActionId(null);
    }
  }

  async function handleSaveEdit(id: string, draft: AdminUserDraft) {
    setSaving(true);
    const ok = await patchUser(id, {
      name: draft.name.trim(),
      role: draft.role,
      subscriptionTier: draft.subscriptionTier,
      currentRole: draft.currentRole.trim() || undefined,
      targetRole: draft.targetRole.trim() || undefined,
    });
    setSaving(false);
    if (ok) {
      setEditUser(null);
    }
  }

  async function runConfirmedAction() {
    if (!confirmAction) return;
    const { type, user } = confirmAction;
    setConfirmAction(null);

    if (type === 'suspend') {
      await patchUser(user.id, { suspend: !user.suspendedAt });
    } else if (type === 'delete') {
      setActionId(user.id);
      try {
        const res = await fetch(`/api/admin/users/${user.id}`, { method: 'DELETE', credentials: 'include' });
        if (!res.ok) throw new Error('Delete failed');
        toast.success('User deleted');
        await loadUsers(searchQuery, page);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Delete failed');
      } finally {
        setActionId(null);
      }
    } else if (type === 'restore') {
      await patchUser(user.id, { suspend: false });
    }
  }

  if (status === 'loading') {
    return (
      <div className="aurora-bg min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-violet-400" size={32} />
      </div>
    );
  }

  return (
    <div className="aurora-bg min-h-screen p-4 sm:p-8" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 style={{ color: 'var(--cp-text-primary)', fontWeight: 700, fontSize: '1.5rem' }}>User Management</h1>
          <p style={{ color: 'var(--cp-text-muted)', fontSize: '0.85rem' }}>Platform oversight & account administration</p>
        </div>

        {meta?.stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {[
              { label: 'Users', value: meta.total },
              { label: 'PRO subs', value: meta.stats.proSubscribers },
              { label: 'Courses', value: meta.stats.courses },
              { label: 'Est. revenue/mo', value: `$${meta.stats.estimatedRevenue}` },
            ].map(s => (
              <div key={s.label} className="glass-card rounded-xl p-3">
                <div style={{ color: 'var(--cp-text-muted)', fontSize: '0.72rem' }}>{s.label}</div>
                <div style={{ color: 'var(--cp-text-primary)', fontWeight: 700 }}>{s.value}</div>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2 mb-6">
          <div className="flex-1 flex items-center gap-2 rounded-xl px-4 py-3 glass-card">
            <Search size={16} color="#64748b" />
            <input
              value={q}
              onChange={e => setQ(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && void loadUsers(q, 1)}
              placeholder="Search by name or email…"
              className="flex-1 bg-transparent outline-none"
              style={{ color: 'var(--cp-text-primary)', fontSize: '0.9rem' }}
            />
          </div>
          <button type="button" className="btn-primary rounded-xl px-4 py-3" onClick={() => { setSearchQuery(q); setPage(1); }}>
            Search
          </button>
        </div>

        <AsyncState loading={loading && users.length === 0} error={error} onRetry={() => void loadUsers(searchQuery, page)} empty={!loading && users.length === 0} emptyMessage="No users found.">
          <div className="glass-card rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm" style={{ borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--cp-border)', color: 'var(--cp-text-muted)' }}>
                    {['Name', 'Email', 'Role', 'Subscription', 'Resume', 'ATS', 'Created', 'Actions'].map(h => (
                      <th key={h} className="text-left px-4 py-3 font-semibold whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr
                      key={u.id}
                      style={{
                        borderBottom: '1px solid var(--cp-border)',
                        opacity: u.suspendedAt || u.deletedAt ? 0.55 : 1,
                      }}
                    >
                      <td className="px-4 py-3" style={{ color: 'var(--cp-text-primary)', fontWeight: 600 }}>
                        {u.name ?? '—'}
                        {u.suspendedAt ? ' ⏸' : ''}
                        {u.deletedAt ? ' 🗑' : ''}
                      </td>
                      <td className="px-4 py-3" style={{ color: 'var(--cp-text-muted)' }}>{u.email ?? '—'}</td>
                      <td className="px-4 py-3">{u.role}</td>
                      <td className="px-4 py-3">{u.profile?.subscriptionTier ?? 'FREE'}</td>
                      <td className="px-4 py-3">{u.resumes[0]?.parseStatus ?? 'None'}</td>
                      <td className="px-4 py-3">{u.resumes[0]?.atsScore ?? '—'}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{formatDate(u.createdAt)}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          <button type="button" title="View" onClick={() => setViewUser(u)} className="p-1.5 rounded-lg glass-card">
                            <Eye size={14} />
                          </button>
                          <button type="button" title="Edit" onClick={() => setEditUser(u)} disabled={!!u.deletedAt} className="p-1.5 rounded-lg glass-card">
                            <Pencil size={14} />
                          </button>
                          <button
                            type="button"
                            title={u.suspendedAt ? 'Restore account' : 'Suspend'}
                            disabled={actionId === u.id || !!u.deletedAt}
                            onClick={() => setConfirmAction({ type: u.suspendedAt ? 'restore' : 'suspend', user: u })}
                            className="p-1.5 rounded-lg glass-card"
                          >
                            {u.suspendedAt ? <UserCheck size={14} /> : <UserX size={14} />}
                          </button>
                          <button
                            type="button"
                            title="Delete"
                            disabled={actionId === u.id || u.id === session?.user?.id}
                            onClick={() => setConfirmAction({ type: 'delete', user: u })}
                            className="p-1.5 rounded-lg"
                            style={{ background: 'rgba(244,63,94,0.12)', color: '#fda4af' }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {meta && meta.pages > 1 && (
            <div className="flex justify-center gap-2 mt-6">
              <button type="button" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))} className="rounded-xl px-4 py-2 text-sm glass-card">
                Previous
              </button>
              <span style={{ color: 'var(--cp-text-muted)', fontSize: '0.85rem', alignSelf: 'center' }}>
                Page {meta.page} / {meta.pages}
              </span>
              <button type="button" disabled={page >= meta.pages} onClick={() => setPage(p => p + 1)} className="rounded-xl px-4 py-2 text-sm glass-card">
                Next
              </button>
            </div>
          )}
        </AsyncState>
      </div>

      <AdminUserEditDialog
        user={editUser}
        open={Boolean(editUser)}
        onOpenChange={open => { if (!open) setEditUser(null); }}
        onSave={handleSaveEdit}
        saving={saving}
      />

      <CareerDialog open={Boolean(viewUser)} onOpenChange={open => { if (!open) setViewUser(null); }}>
        <DialogTitle className="sr-only">View user</DialogTitle>
        {viewUser && (
          <div className="pr-8 space-y-2 text-sm">
            <h3 style={{ color: 'var(--cp-text-primary)', fontWeight: 700, fontSize: '1.1rem' }}>{viewUser.name ?? 'Unnamed'}</h3>
            <p style={{ color: 'var(--cp-text-muted)' }}>{viewUser.email}</p>
            <div className="grid grid-cols-2 gap-2 mt-4" style={{ color: 'var(--cp-text-muted)' }}>
              <div>Role: {viewUser.role}</div>
              <div>Plan: {viewUser.profile?.subscriptionTier ?? 'FREE'}</div>
              <div>Resume: {viewUser.resumes[0]?.parseStatus ?? 'None'}</div>
              <div>ATS: {viewUser.resumes[0]?.atsScore ?? '—'}</div>
              <div>Created: {formatDate(viewUser.createdAt)}</div>
              <div>Status: {viewUser.suspendedAt ? 'Suspended' : viewUser.deletedAt ? 'Deleted' : 'Active'}</div>
            </div>
          </div>
        )}
      </CareerDialog>

      <CareerDialog open={Boolean(confirmAction)} onOpenChange={open => { if (!open) setConfirmAction(null); }}>
        <DialogTitle className="sr-only">Confirm action</DialogTitle>
        {confirmAction && (
          <div className="pr-8">
            <h3 style={{ color: 'var(--cp-text-primary)', fontWeight: 700, marginBottom: '8px' }}>Confirm action</h3>
            <p style={{ color: 'var(--cp-text-muted)', fontSize: '0.9rem', marginBottom: '16px' }}>
              {confirmAction.type === 'delete' && `Delete ${confirmAction.user.email}? This soft-deletes the account.`}
              {confirmAction.type === 'suspend' && `Suspend ${confirmAction.user.email}? They will not be able to sign in.`}
              {confirmAction.type === 'restore' && `Restore ${confirmAction.user.email}? Suspension will be lifted.`}
            </p>
            <div className="flex gap-2">
              <button type="button" onClick={() => void runConfirmedAction()} className="btn-primary flex-1 py-2 rounded-xl text-sm font-semibold">
                Confirm
              </button>
              <button type="button" onClick={() => setConfirmAction(null)} className="flex-1 py-2 rounded-xl text-sm glass-card">
                Cancel
              </button>
            </div>
          </div>
        )}
      </CareerDialog>
    </div>
  );
}
