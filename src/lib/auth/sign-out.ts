'use client';

import { signOut as nextAuthSignOut } from 'next-auth/react';
import { resetAppQueryCacheForSignOut } from '@/lib/query-client';

async function clearClientAuthState() {
  await resetAppQueryCacheForSignOut();
  try {
    const keys = Object.keys(localStorage);
    for (const key of keys) {
      if (
        key.startsWith('cp-onboarding-')
        || key.startsWith('cp_daily_claim_v1_')
        || key.startsWith('elevatex-')
      ) {
        localStorage.removeItem(key);
      }
    }
  } catch {
    /* ignore */
  }
}

/** Hard redirect prevents back-button access to cached admin pages. */
export async function signOutAdmin() {
  await clearClientAuthState();
  // Fire sign-out without blocking the redirect UX path.
  void nextAuthSignOut({ redirect: false });
  if (typeof window !== 'undefined') {
    window.location.replace('/admin/login?loggedOut=1');
  }
}

export async function signOutUser() {
  await clearClientAuthState();
  // Fire sign-out without blocking the redirect UX path.
  void nextAuthSignOut({ redirect: false });
  if (typeof window !== 'undefined') {
    window.location.replace('/?loggedOut=1');
  }
}
