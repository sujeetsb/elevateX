import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

/** Interactive `$transaction(fn)` defaults (5s) are too low for resume parse + skill upserts on Neon. */
export const prismaInteractiveTx = {
  /** Core resume row + profile + recommendations (skills linked separately). */
  heavy: { maxWait: 30_000, timeout: 120_000 },
  /** deleteMany + batch creates (recommendations, roadmap). */
  standard: { maxWait: 20_000, timeout: 45_000 },
} as const;
