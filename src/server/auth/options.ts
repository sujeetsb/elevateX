import type { NextAuthOptions } from 'next-auth';
import { PrismaAdapter } from '@next-auth/prisma-adapter';
import GoogleProvider from 'next-auth/providers/google';
import GitHubProvider from 'next-auth/providers/github';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { prisma } from '@/server/db/prisma';
import { env } from '@/lib/server-env';
import type { AppRole } from '@/lib/auth/roles';
import { isSuperAdminRole } from '@/lib/auth/roles';

async function findAuthUser(email: string) {
  return prisma.user.findFirst({
    where: { email: email.trim().toLowerCase(), deletedAt: null },
    select: {
      id: true,
      email: true,
      name: true,
      image: true,
      passwordHash: true,
      role: true,
      suspendedAt: true,
    },
  });
}

async function hydrateTokenFromDb(userId: string) {
  const dbUser = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      role: true,
      profile: { select: { onboardingComplete: true, subscriptionTier: true } },
    },
  });
  return {
    role: (dbUser?.role ?? 'USER') as AppRole,
    onboardingComplete: dbUser?.profile?.onboardingComplete ?? false,
    subscriptionTier: dbUser?.profile?.subscriptionTier ?? 'FREE',
  };
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: { strategy: 'jwt', maxAge: 30 * 24 * 60 * 60 },
  pages: { signIn: '/sign-in', error: '/sign-in' },
  providers: [
    ...(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
      ? [
          GoogleProvider({
            clientId: env.GOOGLE_CLIENT_ID,
            clientSecret: env.GOOGLE_CLIENT_SECRET,
          }),
        ]
      : []),
    ...(env.GITHUB_ID && env.GITHUB_SECRET
      ? [
          GitHubProvider({
            clientId: env.GITHUB_ID,
            clientSecret: env.GITHUB_SECRET,
          }),
        ]
      : []),
    CredentialsProvider({
      id: 'credentials',
      name: 'Email',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const email = credentials?.email?.trim().toLowerCase();
        const password = credentials?.password;
        if (!email || !password) return null;

        const user = await findAuthUser(email);
        if (!user?.passwordHash || user.suspendedAt) return null;
        if (isSuperAdminRole(user.role)) return null;

        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) return null;

        return {
          id: user.id,
          email: user.email ?? undefined,
          name: user.name ?? undefined,
          image: user.image ?? undefined,
        };
      },
    }),
    CredentialsProvider({
      id: 'admin-credentials',
      name: 'Admin',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const email = credentials?.email?.trim().toLowerCase();
        const password = credentials?.password;
        if (!email || !password) return null;

        const user = await findAuthUser(email);
        if (!user?.passwordHash || user.suspendedAt) return null;
        if (!isSuperAdminRole(user.role)) return null;

        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) return null;

        return {
          id: user.id,
          email: user.email ?? undefined,
          name: user.name ?? undefined,
          image: user.image ?? undefined,
        };
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (!user.id) return true;

      const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { role: true, suspendedAt: true, deletedAt: true },
      });

      if (!dbUser || dbUser.deletedAt || dbUser.suspendedAt) return false;

      const provider = account?.provider;
      const isAdminProvider = provider === 'admin-credentials';
      const isSuperAdmin = isSuperAdminRole(dbUser.role);

      if (isAdminProvider && !isSuperAdmin) return false;
      if (!isAdminProvider && isSuperAdmin) return false;

      if (provider === 'google' || provider === 'github') {
        if (isSuperAdmin) return false;
      }

      return true;
    },
    async jwt({ token, user, trigger, session }) {
      if (user?.id) {
        token.sub = user.id;
      }
      if (token.sub) {
        const hydrated = await hydrateTokenFromDb(token.sub);
        token.role = hydrated.role;
        token.onboardingComplete = hydrated.onboardingComplete;
        token.subscriptionTier = hydrated.subscriptionTier;
      }
      if (trigger === 'update' && session && typeof session === 'object') {
        const s = session as { onboardingComplete?: boolean; subscriptionTier?: string };
        if (typeof s.onboardingComplete === 'boolean') token.onboardingComplete = s.onboardingComplete;
        if (typeof s.subscriptionTier === 'string') token.subscriptionTier = s.subscriptionTier;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
        session.user.role = token.role;
        session.user.onboardingComplete = token.onboardingComplete ?? false;
        session.user.subscriptionTier = token.subscriptionTier ?? 'FREE';
      }
      return session;
    },
  },
  events: {
    async signIn({ user }) {
      if (!user.id) return;
      try {
        await prisma.activityLog.create({
          data: {
            userId: user.id,
            verb: 'SIGN_IN',
            subject: 'session',
          },
        });
      } catch {
        // DB may be unavailable during local UI-only dev
      }
    },
  },
};
