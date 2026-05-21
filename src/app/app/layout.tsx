'use client';

import type { ReactNode } from 'react';
import { Layout } from '@/components/Layout';

export default function AppShellLayout({ children }: { children: ReactNode }) {
  return <Layout>{children}</Layout>;
}
