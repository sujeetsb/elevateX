import 'next-auth';
import 'next-auth/jwt';
import type { AppRole } from '@/lib/auth/roles';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      role?: AppRole;
      onboardingComplete?: boolean;
      subscriptionTier?: string;
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    role?: AppRole;
    onboardingComplete?: boolean;
    subscriptionTier?: string;
  }
}
