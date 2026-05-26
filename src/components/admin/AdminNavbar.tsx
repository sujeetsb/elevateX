'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Shield, LogOut, Users } from 'lucide-react';
import { BrandLogo } from '@/components/BrandLogo';
import { signOutAdmin } from '@/lib/auth/sign-out';

const adminNavItems = [{ path: '/admin', icon: Users, label: 'Users' }];

export function AdminNavbar() {
  const pathname = usePathname() ?? '';

  return (
    <header
      className="sticky top-0 z-50 glass-card border-b"
      style={{ borderColor: 'var(--cp-border)', fontFamily: "'Space Grotesk', sans-serif" }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-8 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-6">
          <Link href="/admin" className="flex items-center gap-2 shrink-0">
            <BrandLogo size={28} showName={false} />
            <span className="flex items-center gap-1.5" style={{ color: 'var(--cp-text-primary)', fontWeight: 700 }}>
              <Shield size={18} color="#a78bfa" />
              Admin
            </span>
          </Link>
          <nav className="hidden sm:flex items-center gap-1" aria-label="Admin navigation">
            {adminNavItems.map(({ path, icon: Icon, label }) => {
              const active = pathname === path;
              return (
                <Link
                  key={path}
                  href={path}
                  className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm transition-colors"
                  style={{
                    background: active ? 'var(--cp-accent-bg)' : 'transparent',
                    color: active ? 'var(--cp-accent-light)' : 'var(--cp-text-muted)',
                    fontWeight: active ? 600 : 400,
                  }}
                >
                  <Icon size={16} />
                  {label}
                </Link>
              );
            })}
          </nav>
        </div>
        <button
          type="button"
          onClick={() => void signOutAdmin()}
          className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm glass-card"
          style={{ color: 'var(--cp-text-muted)' }}
        >
          <LogOut size={16} />
          Sign out
        </button>
      </div>
    </header>
  );
}
