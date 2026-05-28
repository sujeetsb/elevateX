'use client';

import { signOut as nextAuthSignOut } from 'next-auth/react';
import { resetAppQueryCacheForSignOut } from '@/lib/query-client';
import { clearRoutingCache } from '@/lib/auth/routing-cache';

async function clearClientAuthState() {
  await resetAppQueryCacheForSignOut();
  clearRoutingCache();
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

/** Clear NextAuth session before hard redirect — must complete before navigation. */
async function destroySession() {
  try {
    await nextAuthSignOut({ redirect: false });
  } catch {
    try {
      await fetch('/api/auth/signout', { method: 'POST', credentials: 'include' });
    } catch {
      /* ignore */
    }
  }
}

function hardRedirect(path: string) {
  if (typeof window !== 'undefined') {
    window.location.replace(path);
  }
}

/** Hard redirect prevents back-button access to cached admin pages. */
export async function signOutAdmin() {
  await clearClientAuthState();
  await destroySession();
  hardRedirect('/admin/login?loggedOut=1');
}

/** Invalid session — user missing from DB. Notify, logout, send to sign-up. */
export async function signOutUnregistered() {
  await clearClientAuthState();
  await destroySession();
  hardRedirect('/sign-up?loggedOut=1&reason=unregistered');
}

export async function signOutUser() {
  await clearClientAuthState();
  await destroySession();
  hardRedirect('/sign-in?loggedOut=1');
}
