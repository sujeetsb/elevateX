#!/usr/bin/env node
/**
 * Raw Neon/Postgres latency via Prisma — isolates DB round-trip from app layer.
 *   node scripts/benchmark-db.mjs
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const SAMPLES = 5;

async function time(label, fn) {
  const times = [];
  let last;
  for (let i = 0; i < SAMPLES; i++) {
    const start = performance.now();
    last = await fn();
    times.push(Math.round(performance.now() - start));
  }
  const avg = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
  const min = Math.min(...times);
  const max = Math.max(...times);
  console.log(
    `  ${String(avg).padStart(5)}ms  (${String(min).padStart(4)}–${String(max).padStart(4)})  ${label}`,
  );
  return last;
}

async function main() {
  console.log(`DB benchmark (${SAMPLES} samples each, Neon via Prisma)\n`);

  const user = await prisma.user.findFirst({
    where: {
      deletedAt: null,
      profile: { onboardingComplete: true },
      email: process.env.BENCH_EMAIL ?? undefined,
    },
    select: { id: true, email: true },
  });

  if (!user) {
    console.error('No onboarded user found — run: npm run db:seed');
    process.exit(1);
  }

  console.log(`User: ${user.email} (${user.id})\n`);

  await time('SELECT 1 (connection warm-up)', () => prisma.$queryRaw`SELECT 1`);

  await time('/me-style parallel bundle', async () => {
    const uid = user.id;
    await Promise.all([
      prisma.user.findUnique({ where: { id: uid }, select: { id: true, name: true, email: true, image: true, role: true } }),
      prisma.profile.findUnique({ where: { userId: uid } }),
      prisma.userSkill.findMany({ where: { userId: uid }, take: 80, include: { skill: true } }),
      prisma.userAnalytics.findUnique({ where: { userId: uid } }),
      prisma.resume.findFirst({ where: { userId: uid }, orderBy: { updatedAt: 'desc' } }),
    ]);
  });

  await time('routing-state query', () =>
    prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        role: true,
        profile: { select: { onboardingComplete: true, subscriptionTier: true } },
      },
    }),
  );

  await time('courses list (user enrollments)', () =>
    prisma.userCourse.findMany({
      where: { userId: user.id },
      take: 24,
      orderBy: { lastAccessedAt: 'desc' },
      include: { course: { select: { id: true, title: true, description: true, difficulty: true, estimatedDays: true } } },
    }),
  );

  await time('learning roadmap + progress', async () => {
    const roadmap = await prisma.learningRoadmap.findFirst({
      where: { userId: user.id, deletedAt: null },
      orderBy: { updatedAt: 'desc' },
    });
    if (roadmap) {
      await prisma.learningProgress.findMany({
        where: { userId: user.id, roadmapId: roadmap.id },
        select: { resourceId: true, completed: true, progressPct: true },
      });
    }
  });

  console.log('\nCompare API avg vs DB avg to estimate app-layer overhead (serialization, auth, AI cache misses).');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
