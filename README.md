# ElevateX

Next.js (App Router) AI career guidance platform: auth, profile, resume parsing, job recommendations, learning roadmaps, and AI mentor chat. Design source: [Figma — Create New Component](https://www.figma.com/design/2wAdqmgfWzk9dxIuCfhInO/Create-New-Component).

## Prerequisites

- **Node.js** 20.x (matches `package.json` dev tooling)
- **PostgreSQL** database (Neon, RDS, or local Postgres)
- **Optional but recommended:** [Upstash Redis](https://upstash.com) for caching and API rate limiting
- **Optional:** [Inngest](https://www.inngest.com) dev server for background jobs (resume parsing, job sync, recommendations)
- **Optional:** Google Gemini API key for full LLM resume parsing and mentor replies (without it, the app uses deterministic fallbacks for parsing and a mock mentor response)

---

## Quick start (local development)

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Copy the example and fill in secrets:

```bash
cp .env.example .env
# Optionally mirror overrides in .env.local for Next.js-only vars
```

**Important for Prisma:** `prisma` CLI loads `.env` and `prisma/.env` — it does **not** read `.env.local`. Put `DATABASE_URL` in the project root `.env` (or `prisma/.env`) so `npm run db:*` works.

| Variable | Required | Purpose |
|----------|----------|---------|
| `DATABASE_URL` | **Yes** (runtime + Prisma) | PostgreSQL connection string |
| `NEXTAUTH_URL` | **Yes** (production) | Public app URL, e.g. `http://localhost:3000` |
| `NEXTAUTH_SECRET` | **Yes** (production) | At least 16 characters; use `openssl rand -base64 32` |
| `DEV_CREDENTIALS_ENABLED` | Optional | Set `true` to allow email/password sign-in via NextAuth Credentials |
| `GEMINI_API_KEY` | Optional | Resume intelligence + roadmap generation via Gemini; omit for local fallbacks |
| `INNGEST_EVENT_KEY` / `INNGEST_SIGNING_KEY` | Optional | Production Inngest; dev uses Inngest CLI without keys |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | Optional | Cache + rate limiting (skipped if unset) |
| `UPLOADTHING_TOKEN` | **Yes** (or secret+app id) | Paste the **v7 token** from the [UploadThing dashboard](https://uploadthing.com/dashboard) (base64 blob). Alternatively set `UPLOADTHING_SECRET` (`sk_…`) + `UPLOADTHING_APP_ID`; the app builds a token. Optional: `UPLOADTHING_REGIONS` (default `sea1`). |

`@sentry/nextjs` is included; for production error reporting, complete the [official Sentry Next.js setup](https://docs.sentry.io/platforms/javascript/guides/nextjs/) (wrap `next.config`, env vars such as `SENTRY_DSN`, etc.). Starter files live under `src/sentry.*.config.ts`.

`SKIP_ENV_VALIDATION=1` in `.env` relaxes strict env parsing during `npm run build` (common in CI).

### 3. Create / migrate the database

Apply the Prisma schema to your database (non-interactive; good for first-time setup):

```bash
npm run db:push
```

Seed demo users, jobs, and sample data:

```bash
npm run db:seed
```

Other database commands:

| Script | Purpose |
|--------|---------|
| `npm run db:generate` | Regenerate Prisma Client |
| `npm run db:migrate` | Interactive `prisma migrate dev` (creates migration files) |
| `npm run db:studio` | Open Prisma Studio |
| `npm run db:seed` | Run `prisma/seed.ts` |

### 4. Run the application

**Terminal A — Next.js dev server**

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

**Terminal B — Inngest dev server (recommended)**

Resume parsing, job sync, recommendation refresh, and roadmap generation run as Inngest functions. Without the dev server, those events may not execute locally.

```bash
npm run inngest:dev
```

This points Inngest at `http://localhost:3000/api/inngest`.

### 5. Sign in

After seeding:

- **Demo users:** `alice@elevatex.demo`, `bob@elevatex.demo`, or `admin@elevatex.demo`
- **Password (all demo users):** `elevatex-demo`

Or use **Sign Up** on the landing page to create a new account (requires `DEV_CREDENTIALS_ENABLED=true` for email/password, or configure Google/GitHub OAuth in `.env`).

---

## Production build

```bash
npm run build
npm run start
```

Ensure `NODE_ENV=production`, a strong `NEXTAUTH_SECRET`, and a real `DATABASE_URL`. Set `SKIP_ENV_VALIDATION` only if you intentionally bypass strict env checks.

---

## Deploy to Vercel

Production build verified locally (`npm run build`). Follow these steps:

### 1. Push code to GitHub

Vercel deploys from Git. If this folder is not a repo yet:

```bash
git init
git add .
git commit -m "Initial ElevateX deploy"
gh repo create elevatex --private --source=. --push
```

Or create a repo on GitHub and push manually.

### 2. Import project in Vercel

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import your GitHub repository
3. **Framework preset:** Next.js (auto-detected)
4. **Root directory:** `.` (project root)
5. **Build command:** `npm run build` (default)
6. **Install command:** `npm install` (runs `postinstall` → `prisma generate`)

Do **not** deploy yet — add environment variables first.

### 3. Required environment variables

Set these in **Vercel → Project → Settings → Environment Variables** (Production + Preview):

| Variable | Required | Notes |
|----------|----------|-------|
| `DATABASE_URL` | **Yes** | Your Neon/Postgres URL (`?sslmode=require`) |
| `NEXTAUTH_SECRET` | **Yes** | `openssl rand -base64 32` |
| `NEXTAUTH_URL` | **Yes** | `https://YOUR-APP.vercel.app` (update after first deploy if needed) |
| `SKIP_ENV_VALIDATION` | **Yes** (initially) | Set to `1` so build passes before all optional keys are set |
| `UPLOADTHING_TOKEN` | **Yes** | From [UploadThing dashboard](https://uploadthing.com/dashboard) |
| `GEMINI_API_KEY` | Recommended | Resume AI + mentor chat |
| `INNGEST_EVENT_KEY` | Recommended | From [Inngest dashboard](https://app.inngest.com) |
| `INNGEST_SIGNING_KEY` | Recommended | Required for background jobs in production |
| `UPSTASH_REDIS_REST_URL` | Optional | Cache + rate limiting |
| `UPSTASH_REDIS_REST_TOKEN` | Optional | Pair with URL above |
| `GOOGLE_CLIENT_ID` | Optional | OAuth sign-in |
| `GOOGLE_CLIENT_SECRET` | Optional | OAuth sign-in |
| `GITHUB_ID` | Optional | OAuth sign-in |
| `GITHUB_SECRET` | Optional | OAuth sign-in |

After the first deploy, set `NEXTAUTH_URL` to your exact production URL and redeploy.

### 4. Prepare the database

Run once against your production database (from your machine):

```bash
DATABASE_URL="your-neon-url" npm run db:push
DATABASE_URL="your-neon-url" npm run db:seed   # optional demo users
```

Or use Vercel’s **Postgres/Neon integration** and run migrations from CI or locally.

### 5. Connect Inngest (background jobs)

Resume parsing, roadmap generation, and job sync use Inngest.

1. Create an app at [app.inngest.com](https://app.inngest.com)
2. Add your Vercel URL: `https://YOUR-APP.vercel.app/api/inngest`
3. Copy **Event Key** and **Signing Key** into Vercel env vars
4. Deploy — Inngest will sync functions automatically

Without Inngest, resume uploads may stay stuck on “processing”.

### 6. Configure OAuth & UploadThing callbacks

**Google OAuth** (Google Cloud Console → Credentials):

- Authorized redirect URI: `https://YOUR-APP.vercel.app/api/auth/callback/google`

**GitHub OAuth** (GitHub → Developer settings):

- Callback URL: `https://YOUR-APP.vercel.app/api/auth/callback/github`

**UploadThing** dashboard:

- Set app URL / allowed origins to your Vercel domain

### 7. Deploy

Click **Deploy** in Vercel, or from CLI:

```bash
npx vercel login
npx vercel --prod
```

### 8. Post-deploy checklist

- [ ] Landing page loads at `/`
- [ ] Sign up / sign in works
- [ ] Onboarding + resume upload works
- [ ] Inngest dashboard shows synced functions
- [ ] `/api/health` returns `{ "ok": true }`

### Alternative: deploy without GitHub

```bash
cd /path/to/CareerPilot-Figma
npx vercel login
npx vercel        # preview
npx vercel --prod # production
```

Set env vars via `npx vercel env add` or the Vercel dashboard.

### Troubleshooting (Vercel)

| Issue | Fix |
|-------|-----|
| Build fails on env validation | Set `SKIP_ENV_VALIDATION=1` |
| Prisma client missing | Ensure `DATABASE_URL` is set before build; `postinstall` runs `prisma generate` |
| Auth redirect loops | `NEXTAUTH_URL` must match your live domain exactly |
| Resume stuck processing | Connect Inngest; verify `/api/inngest` is reachable |
| Upload fails | Set `UPLOADTHING_TOKEN`; allow Vercel domain in UploadThing |

---

## Testing

| Script | Purpose |
|--------|---------|
| `npm run lint` | Next.js ESLint |
| `npm run test` | Vitest unit tests |
| `npm run e2e:install` | Install Playwright Chromium (first time) |
| `npm run e2e` | Playwright E2E (starts dev server + Inngest per `playwright.config.js`) |

---

## User manual

### Landing (`/`)

- Switch between **Sign In** and **Sign Up**.
- Enter email and password (minimum 8 characters). Sign up may ask for your full name.
- **Continue with Google** uses NextAuth OAuth if `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` are set.
- After successful sign-in or sign-up, you are sent to **Onboarding** until your profile is complete.

### Onboarding (`/onboarding`)

- **Step 0 — Resume:** Upload a PDF, DOCX, or text file via **UploadThing**, or paste resume text. The app stores metadata and extracted text, then shows parse status; when parsing completes, extracted fields can populate later steps.
- **Later steps:** Confirm or edit name, role, experience, skills, goals, and industry.
- **Finish:** Saves profile via the API and marks onboarding complete, then routes to the app dashboard.

### App shell (`/app/*`)

Protected routes require a signed-in session and completed onboarding (see `Layout`).

| Area | Path | What you do |
|------|------|-------------|
| **Dashboard** | `/app/dashboard` | Overview: XP, streak, ATS snapshot, quick links. |
| **Jobs** | `/app/jobs` | Browse AI-ranked jobs; **Save** and **Apply** persist to your account. |
| **Courses / Roadmap** | `/app/courses`, `/app/roadmap`, `/app/courses/[id]` | Learning path from your active roadmap; mark lessons complete to track progress. |
| **Mentor** | `/app/mentor` | Chat with the AI mentor; history is stored when the backend is configured. |
| **Profile** | `/app/profile` | View and edit profile, badges, skills. |
| **ATS** | `/app/ats` | Resume / ATS tooling (studio flows). |

### Tips

1. **Background jobs:** For resume parsing and recommendations to finish in dev, keep **Inngest dev** running (`npm run inngest:dev`).
2. **Gemini:** With `GEMINI_API_KEY` set, resume parsing and mentor answers use Google’s API; without it, parsing uses heuristics/fallbacks and mentor chat returns a deterministic mock reply.
3. **Redis:** Without Upstash, caching and rate limits are skipped; the app still runs.
4. **UploadThing:** Set **`UPLOADTHING_TOKEN`** from the dashboard (recommended), or **`UPLOADTHING_SECRET`** (`sk_…`) + **`UPLOADTHING_APP_ID`**. Add **`UPLOADTHING_REGIONS`** if your app is not in the default region (`sea1`). Pasted-text-only resumes still work with the JSON `rawText` API path.

---

## Project structure (high level)

- `src/app/` — App Router pages and `api/` routes (`/api/v1/*`, NextAuth, Inngest)
- `src/views/` — Large UI screens (Landing, Onboarding, Dashboard, Jobs, etc.)
- `src/components/` — Shared UI and `GameProvider` (hydrates from `/api/v1/me` and related APIs)
- `prisma/` — Schema, migrations context, `seed.ts`
- `e2e/` — Playwright tests

---

## Troubleshooting

| Issue | What to check |
|-------|----------------|
| `DATABASE_URL` / Prisma errors | `DATABASE_URL` in root `.env` or `prisma/.env`; database reachable |
| Sign-in fails | `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `DEV_CREDENTIALS_ENABLED`, user exists in DB |
| Resume stuck on “processing” | Inngest dev running; `POST /api/inngest` reachable |
| Build fails on env | `SKIP_ENV_VALIDATION=1` or fill required vars per `src/lib/server-env.ts` |
| UploadThing / resume upload | **`UPLOADTHING_TOKEN`** (dashboard) or `UPLOADTHING_SECRET` + `UPLOADTHING_APP_ID`; see `src/lib/uploadthing/resolve-token.ts` |

For product and UI guidelines, see `guidelines/Guidelines.md`.

---

**ElevateX** — Created by Sujeet Brahmankar.
