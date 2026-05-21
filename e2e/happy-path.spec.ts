import { test, expect } from '@playwright/test';

async function pollJson<T>(
  opts: {
    label: string;
    poll: () => Promise<T>;
    predicate: (v: T) => boolean;
    timeoutMs: number;
    intervalMs: number;
  },
) {
  const start = Date.now();
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const value = await opts.poll();
    if (opts.predicate(value)) return value;
    if (Date.now() - start > opts.timeoutMs) {
      throw new Error(`Timed out waiting for: ${opts.label}`);
    }
    await new Promise(r => setTimeout(r, opts.intervalMs));
  }
}

test('happy path: auth -> resume parse -> roadmap/learning -> jobs -> mentor chat', async ({ page }) => {
  const email = `e2e_${Date.now()}@example.com`;
  const password = 'elevatex-demo';
  const fullName = 'E2E Tester';

  await page.goto('/');

  // Sign up (Landing page)
  await page.getByRole('button', { name: /^Sign Up$/ }).click();
  await page.locator('#signup-name').fill(fullName);
  await page.locator('#auth-email').fill(email);
  await page.locator('#auth-password').fill(password);
  await page.getByRole('button', { name: /Start Your Journey/i }).click();
  await page.waitForURL(/\/onboarding/i, { timeout: 30_000 });

  const api = page.context().request;
  const authHeaders = { headers: { 'Content-Type': 'application/json' } };

  // 1) Upload resume (rawText path) to trigger async parse via Inngest
  const rawText = [
    'E2E Tester',
    'Senior Software Engineer',
    'Skills: TypeScript, React, Node.js, PostgreSQL, Testing',
    'Experience: 5 years building SaaS products.',
    'Achievements: Reduced latency by 30%, improved reliability, led cross-functional teams.',
    'Looking for: Senior Software Engineer role focusing on system design and testing.',
  ].join('\n');

  const uploadRes = await api.post('/api/v1/resumes', {
    ...authHeaders,
    json: { rawText, title: 'E2E Resume' },
  });
  expect(uploadRes.ok()).toBeTruthy();
  const uploadJson = await uploadRes.json();
  const resumeId = uploadJson?.data?.resumeId as string;
  expect(resumeId).toBeTruthy();

  // 2) Poll parse completion
  const parseDone = await pollJson({
    label: 'resume parse COMPLETE',
    timeoutMs: 90_000,
    intervalMs: 2_000,
    poll: async () => {
      const r = await api.get(`/api/v1/resumes/${resumeId}`);
      return r.json();
    },
    predicate: (j: any) => j?.data?.parseStatus === 'COMPLETE',
  });
  expect(parseDone.data.parseStatus).toBe('COMPLETE');

  // 3) Set onboardingComplete + basic profile for personalization
  const profileRes = await api.patch('/api/v1/profile', {
    ...authHeaders,
    json: {
      name: fullName,
      currentRole: 'Software Engineer',
      experienceYears: '5',
      skills: ['TypeScript', 'React', 'Node.js'],
      careerGoal: 'Lead platform engineering with strong quality and reliability.',
      targetRole: 'Senior Software Engineer',
      preferredIndustry: 'Technology',
      onboardingComplete: true,
      bio: 'E2E testing profile.',
    },
  });
  expect(profileRes.ok()).toBeTruthy();
  const profileJson = await profileRes.json().catch(() => ({}));
  expect(profileJson.ok).toBeTruthy();

  // Mimic onboarding XP grants (Onboarding calls addXP() client-side)
  await api.post('/api/v1/gamification/award', {
    ...authHeaders,
    json: { amount: 100 },
  });
  await api.post('/api/v1/gamification/award', {
    ...authHeaders,
    json: { amount: 500 },
  });

  // Validate hydration
  const meRes = await api.get('/api/v1/me');
  expect(meRes.ok()).toBeTruthy();
  const meJson = await meRes.json();
  expect(meJson?.data?.gamification?.xp).toBeGreaterThan(0);

  // 4) Recommendations
  const jobsRecRes = await api.get('/api/v1/jobs/recommendations');
  expect(jobsRecRes.ok()).toBeTruthy();
  const jobsRecJson = await jobsRecRes.json();
  const jobs = jobsRecJson?.data ?? [];
  expect(Array.isArray(jobs) && jobs.length).toBeTruthy();
  const jobId = String(jobs[0]?.job?.id ?? jobs[0]?.jobId ?? jobs[0]?.id);
  expect(jobId).toBeTruthy();

  // 5) Roadmap should exist after parse follow-ups
  const roadmap = await pollJson({
    label: 'learning roadmap resources',
    timeoutMs: 90_000,
    intervalMs: 2_000,
    poll: async () => (await api.get('/api/v1/learning/roadmap')).json(),
    predicate: (j: any) => Array.isArray(j?.data?.resources) && j.data.resources.length > 0,
  });
  const resources = roadmap.data.resources as Array<any>;
  const resourceId = String(resources[0].resourceId);
  expect(resourceId).toBeTruthy();

  // 6) Learning completion persistence
  const completeLessonRes = await api.post('/api/v1/learning/progress/complete', {
    ...authHeaders,
    json: { resourceId },
  });
  expect(completeLessonRes.ok()).toBeTruthy();

  const roadmapAfter = await api.get('/api/v1/learning/roadmap');
  const roadmapAfterJson = await roadmapAfter.json();
  const prog = roadmapAfterJson?.data?.progress?.byResourceId?.[resourceId];
  expect(prog?.completed).toBeTruthy();
  expect(prog?.progressPct).toBe(100);

  // 7) Job save/apply persistence
  const savedRes = await api.post('/api/v1/jobs/saved', {
    ...authHeaders,
    json: { jobId },
  });
  expect(savedRes.ok()).toBeTruthy();

  const appliedRes = await api.post('/api/v1/jobs/applications', {
    ...authHeaders,
    json: { jobId, status: 'APPLIED' },
  });
  expect(appliedRes.ok()).toBeTruthy();

  const savedList = await (await api.get('/api/v1/jobs/saved')).json();
  const appsList = await (await api.get('/api/v1/jobs/applications')).json();
  expect(savedList?.data?.some((x: any) => String(x.jobId) === jobId)).toBeTruthy();
  expect(appsList?.data?.some((x: any) => String(x.jobId) === jobId)).toBeTruthy();

  // 8) Mentor chat persistence (deterministic mock when Gemini is unavailable)
  const mentorRes = await api.post('/api/v1/ai/mentor/messages', {
    ...authHeaders,
    json: { content: 'Help me plan my next 7 days.' },
  });
  expect(mentorRes.ok()).toBeTruthy();
  const mentorJson = await mentorRes.json();
  expect(mentorJson?.data?.conversationId).toBeTruthy();

  const convId = String(mentorJson.data.conversationId);
  const convsRes = await api.get('/api/v1/ai/mentor/conversations');
  expect(convsRes.ok()).toBeTruthy();
  const convsJson = await convsRes.json();
  expect(Array.isArray(convsJson?.data?.conversations)).toBeTruthy();

  const msgsRes = await api.get(`/api/v1/ai/mentor/conversations/${convId}/messages`);
  expect(msgsRes.ok()).toBeTruthy();
  const msgsJson = await msgsRes.json();
  const messages = msgsJson?.data?.messages ?? [];
  expect(messages.length).toBeGreaterThan(0);
});

