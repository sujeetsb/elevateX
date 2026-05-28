#!/usr/bin/env node
/**
 * Local API latency benchmark — run with server up:
 *   npm start   # or npm run dev
 *   node scripts/benchmark-apis.mjs [baseUrl]
 *
 * Auth (pick one):
 *   BENCH_COOKIE="next-auth.session-token=..." node scripts/benchmark-apis.mjs
 *   BENCH_EMAIL=alice@elevatex.demo BENCH_PASSWORD=elevatex-demo node scripts/benchmark-apis.mjs
 */
const base = process.argv[2] ?? 'http://localhost:3000';
let cookie = process.env.BENCH_COOKIE ?? '';

const routes = [
  '/api/v1/me',
  '/api/v1/auth/routing-state',
  '/api/v1/jobs/recommendations',
  '/api/v1/courses',
  '/api/v1/learning/roadmap',
  '/api/v1/insights',
];

function mergeCookies(existing, setCookieHeaders) {
  const jar = new Map();
  for (const part of (existing ?? '').split(';')) {
    const [k, ...rest] = part.trim().split('=');
    if (k) jar.set(k, rest.join('='));
  }
  for (const header of setCookieHeaders) {
    const pair = header.split(';')[0];
    const [k, ...rest] = pair.split('=');
    if (k) jar.set(k.trim(), rest.join('='));
  }
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
}

async function loginWithCredentials(email, password) {
  const csrfRes = await fetch(`${base}/api/auth/csrf`, { redirect: 'manual' });
  const csrfJson = await csrfRes.json();
  const csrfToken = csrfJson?.csrfToken;
  if (!csrfToken) throw new Error('Could not obtain CSRF token');

  let cookies = mergeCookies('', csrfRes.headers.getSetCookie?.() ?? []);

  const loginRes = await fetch(`${base}/api/auth/callback/credentials`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      ...(cookies ? { cookie: cookies } : {}),
    },
    body: new URLSearchParams({
      csrfToken,
      email,
      password,
      json: 'true',
      callbackUrl: `${base}/app/dashboard`,
    }),
    redirect: 'manual',
  });

  cookies = mergeCookies(cookies, loginRes.headers.getSetCookie?.() ?? []);
  if (!cookies.includes('session-token') && !cookies.includes('next-auth')) {
    const text = await loginRes.text().catch(() => '');
    throw new Error(`Login failed (${loginRes.status}): ${text.slice(0, 200)}`);
  }
  return cookies;
}

async function timeFetch(path) {
  const start = performance.now();
  const res = await fetch(`${base}${path}`, {
    headers: cookie ? { cookie } : {},
  });
  const ms = Math.round(performance.now() - start);
  return { path, status: res.status, ms };
}

async function main() {
  console.log(`Benchmark base: ${base}`);

  if (!cookie && process.env.BENCH_EMAIL && process.env.BENCH_PASSWORD) {
    console.log(`Logging in as ${process.env.BENCH_EMAIL}…`);
    cookie = await loginWithCredentials(process.env.BENCH_EMAIL, process.env.BENCH_PASSWORD);
    console.log('Session cookie obtained.\n');
  } else if (!cookie) {
    console.warn('Set BENCH_COOKIE or BENCH_EMAIL + BENCH_PASSWORD for authenticated routes.\n');
  }

  const results = [];
  for (const path of routes) {
    const samples = [];
    for (let i = 0; i < 3; i++) {
      samples.push(await timeFetch(path));
    }
    const avg = Math.round(samples.reduce((s, r) => s + r.ms, 0) / samples.length);
    const min = Math.min(...samples.map(s => s.ms));
    const max = Math.max(...samples.map(s => s.ms));
    results.push({ path, avg, min, max, status: samples[0].status });
  }

  results.sort((a, b) => b.avg - a.avg);
  console.log('\nEndpoint latency (avg / min / max of 3 requests):');
  for (const r of results) {
    console.log(
      `  ${String(r.avg).padStart(5)}ms  (${String(r.min).padStart(4)}–${String(r.max).padStart(4)})  ${r.status}  ${r.path}`,
    );
  }
  console.log('\nSlowest:', results[0]?.path, `@ ${results[0]?.avg}ms avg`);

  const authOk = results.every(r => r.status !== 401);
  if (!authOk) {
    console.warn('\nSome routes returned 401 — run db:seed and set BENCH_EMAIL/BENCH_PASSWORD.');
    process.exitCode = 1;
  }
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
