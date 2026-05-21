import { PrismaClient, JobSource, SkillProficiency, UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { createHash } from 'node:crypto';

const prisma = new PrismaClient();

const LEGACY_DEMO_EMAILS = ['alice@careerpilot.demo', 'bob@careerpilot.demo', 'admin@careerpilot.demo'];
const DEMO_EMAILS = ['alice@elevatex.demo', 'bob@elevatex.demo', 'admin@elevatex.demo'];

async function main() {
  await prisma.user.deleteMany({ where: { email: { in: [...DEMO_EMAILS, ...LEGACY_DEMO_EMAILS] } } });

  const passwordHash = await bcrypt.hash('elevatex-demo', 10);

  const now = new Date();
  const todayDay = now.toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
  const nowIso = now.toISOString();

  const alice = await prisma.user.create({
    data: {
      email: 'alice@elevatex.demo',
      name: 'Alice Demo',
      passwordHash,
      role: UserRole.USER,
      profile: {
        create: {
          headline: 'Full-stack engineer',
          bio: 'Building scalable web apps.',
          currentRole: 'Software Engineer',
          experienceYears: '4',
          targetRole: 'Senior Software Engineer',
          preferredIndustry: 'Technology',
          careerGoal: 'Lead platform team',
          onboardingComplete: true,
        },
      },
      jobPreferences: {
        create: {
          remoteOnly: true,
          keywords: ['TypeScript', 'React', 'Node'],
        },
      },
      learningPreferences: {
        create: { weeklyHours: 8, preferredFormats: ['video', 'reading'], topics: ['frontend', 'backend'] },
      },
      analytics: {
        create: {
          // Seed persisted gamification state so UI loads xp/streak/badges immediately.
          snapshot: {
            v: 1,
            xp: 1200,
            streak: 7,
            lastActiveDate: todayDay,
            earnedBadges: {
              'badge-week-warrior': nowIso,
              'badge-hot-streak': nowIso,
              'badge-xp-500': nowIso,
            },
          },
          lastActiveAt: now,
          learningMinutes: 60,
          jobClicks: 4,
        },
      },
    },
  });

  await prisma.user.create({
    data: {
      email: 'bob@elevatex.demo',
      name: 'Bob Demo',
      passwordHash,
      role: UserRole.USER,
      profile: {
        create: {
          headline: 'Data engineer',
          targetRole: 'Staff Data Engineer',
          onboardingComplete: true,
        },
      },
      analytics: { create: {} },
    },
  });

  await prisma.user.create({
    data: {
      email: 'admin@elevatex.demo',
      name: 'Admin',
      passwordHash,
      role: UserRole.ADMIN,
      profile: { create: { onboardingComplete: true } },
      analytics: { create: {} },
    },
  });

  const skills = ['typescript', 'react', 'nodejs', 'postgresql', 'aws', 'graphql'];
  for (const slug of skills) {
    await prisma.skill.upsert({
      where: { slug },
      create: { slug, label: slug.charAt(0).toUpperCase() + slug.slice(1), category: 'engineering' },
      update: {},
    });
  }

  const skillRecords = await prisma.skill.findMany({ where: { slug: { in: skills } } });
  for (const s of skillRecords) {
    await prisma.userSkill.create({
      data: { userId: alice.id, skillId: s.id, proficiency: SkillProficiency.ADVANCED },
    });
  }

  await prisma.resume.create({
    data: {
      userId: alice.id,
      title: 'Primary CV',
      rawText:
        'Alice Demo\nSoftware Engineer\nSkills: TypeScript, React, Node.js, PostgreSQL\nExperience: 4 years building SaaS products.\n',
      parseStatus: 'COMPLETE',
      atsScore: 86,
      parsedJson: { headline: 'Engineer', targetRolesSuggested: ['Senior Software Engineer'], skills: ['TypeScript', 'React'], gaps: ['Testing', 'System Design'] },
    },
  });

  // Seed learning roadmap + progress (for /api/v1/learning/roadmap).
  const learningRoadmap = await prisma.learningRoadmap.create({
    data: {
      userId: alice.id,
      title: 'Seed learning roadmap',
      summary: 'Seed data for manual QA',
      status: 'ACTIVE',
      targetRole: 'Senior Software Engineer',
      jsonPlan: {
        weeks: 6,
        modules: [
          {
            title: 'React + Frontend Systems',
            resources: [
              { title: 'React Docs', url: 'https://react.dev/', provider: 'React' },
              { title: 'Testing Library', url: 'https://testing-library.com/', provider: 'Testing Library' },
            ],
          },
          {
            title: 'System Design Essentials',
            resources: [
              { title: 'systemdesign.guru', url: 'https://systemdesign.guru/', provider: 'systemdesign.guru' },
              { title: 'MDN — Web fundamentals', url: 'https://developer.mozilla.org/', provider: 'MDN' },
            ],
          },
        ],
      },
    },
  });

  function resumeResourceId(resource: { provider: string; url: string; title: string }): string {
    const s = `${resource.provider}|${resource.url}|${resource.title}`;
    return createHash('sha256').update(s, 'utf8').digest('hex');
  }

  const seededResources = [
    { title: 'React Docs', url: 'https://react.dev/', provider: 'React', completed: true, progressPct: 100 },
    { title: 'Testing Library', url: 'https://testing-library.com/', provider: 'Testing Library', completed: false, progressPct: 0 },
    { title: 'systemdesign.guru', url: 'https://systemdesign.guru/', provider: 'systemdesign.guru', completed: false, progressPct: 0 },
    { title: 'MDN — Web fundamentals', url: 'https://developer.mozilla.org/', provider: 'MDN', completed: false, progressPct: 0 },
  ];

  await prisma.learningProgress.createMany({
    data: seededResources.map(r => ({
      userId: alice.id,
      roadmapId: learningRoadmap.id,
      resourceId: resumeResourceId({ provider: r.provider, url: r.url, title: r.title }),
      resourceUrl: r.url,
      title: r.title,
      provider: r.provider,
      completed: r.completed,
      progressPct: r.progressPct,
      metadata: { seeded: true },
    })),
  });

  const mockJobs = [
    {
      source: JobSource.MOCK,
      externalId: 'seed-1',
      title: 'Senior TypeScript Engineer',
      company: 'Acme SaaS',
      location: 'Remote',
      description: 'React, Node, PostgreSQL, GraphQL.',
      url: 'https://example.com/job/seed-1',
      salaryMin: 150_000,
      salaryMax: 190_000,
    },
    {
      source: JobSource.MOCK,
      externalId: 'seed-2',
      title: 'Full Stack Developer',
      company: 'Northwind',
      location: 'Austin, TX',
      description: 'TypeScript, AWS, REST APIs.',
      url: 'https://example.com/job/seed-2',
      salaryMin: 130_000,
      salaryMax: 165_000,
    },
  ];

  for (const j of mockJobs) {
    await prisma.job.upsert({
      where: { source_externalId: { source: j.source, externalId: j.externalId } },
      create: { ...j, currency: 'USD', metadata: { seed: true } },
      update: { title: j.title, description: j.description },
    });
  }

  await prisma.aiRecommendation.create({
    data: {
      userId: alice.id,
      kind: 'JOB',
      score: 88,
      payload: { jobExternalId: 'seed-1' },
      rationale: 'Strong TypeScript overlap with saved skills.',
      promptKey: 'jobs.match',
      promptVer: '2025.05.11',
    },
  });

  await prisma.activityLog.createMany({
    data: [
      { userId: alice.id, verb: 'SIGN_IN', subject: 'seed' },
    ],
  });

  console.log('Seed OK — demo password for all demo users: elevatex-demo');
}

main()
  .then(() => prisma.$disconnect())
  .catch(e => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
