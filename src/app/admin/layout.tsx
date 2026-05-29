'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { AdminNavbar } from '@/components/admin/AdminNavbar';

export default function AdminRootLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? '';
  const isLogin = pathname === '/admin/login';

  return (
    <div className="aurora-bg min-h-screen" data-admin-shell style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
      {!isLogin && <AdminNavbar />}
      {children}
    </div>
  );
}
