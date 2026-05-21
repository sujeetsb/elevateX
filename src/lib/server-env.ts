import { z } from 'zod';

const skip = process.env.SKIP_ENV_VALIDATION === '1' || process.env.SKIP_ENV_VALIDATION === 'true';

const server = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().min(1).optional(),
  NEXTAUTH_SECRET: z.string().min(16).optional(),
  NEXTAUTH_URL: z.string().url().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GITHUB_ID: z.string().optional(),
  GITHUB_SECRET: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  INNGEST_EVENT_KEY: z.string().optional(),
  INNGEST_SIGNING_KEY: z.string().optional(),
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
  ADZUNA_APP_ID: z.string().optional(),
  ADZUNA_APP_KEY: z.string().optional(),
  JSEARCH_API_KEY: z.string().optional(),
  REMOTIVE_API_BASE: z.string().url().optional(),
  /** v7 dashboard token (base64 JSON). Preferred over secret+appId. */
  UPLOADTHING_TOKEN: z.string().optional(),
  /** Legacy: API key starting with sk_. Used with UPLOADTHING_APP_ID if UPLOADTHING_TOKEN is unset. */
  UPLOADTHING_SECRET: z.string().optional(),
  UPLOADTHING_APP_ID: z.string().optional(),
  /** Optional comma/space-separated region codes when synthesizing token (default sea1). */
  UPLOADTHING_REGIONS: z.string().optional(),
  DEV_CREDENTIALS_ENABLED: z.enum(['true', 'false']).optional(),
})
  .superRefine((val, ctx) => {
    if (skip) return;
    const t = val.UPLOADTHING_TOKEN?.trim();
    const s = val.UPLOADTHING_SECRET?.trim();
    const a = val.UPLOADTHING_APP_ID?.trim();
    const pairFromLegacyFields = Boolean(s?.startsWith('sk_') && a);
    const pairFromTokenField = Boolean(t?.startsWith('sk_') && a);
    const hasEncodedToken = Boolean(t && !t.startsWith('sk_'));
    if (!hasEncodedToken && !pairFromLegacyFields && !pairFromTokenField) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'Set UPLOADTHING_TOKEN from the UploadThing dashboard, or set UPLOADTHING_SECRET (sk_…) and UPLOADTHING_APP_ID.',
        path: ['UPLOADTHING_TOKEN'],
      });
    }
  });

export type ServerEnv = z.infer<typeof server>;

function parseServer(): ServerEnv {
  const parsed = server.safeParse({
    NODE_ENV: process.env.NODE_ENV,
    DATABASE_URL: process.env.DATABASE_URL,
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    GITHUB_ID: process.env.GITHUB_ID,
    GITHUB_SECRET: process.env.GITHUB_SECRET,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    INNGEST_EVENT_KEY: process.env.INNGEST_EVENT_KEY,
    INNGEST_SIGNING_KEY: process.env.INNGEST_SIGNING_KEY,
    UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
    UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
    ADZUNA_APP_ID: process.env.ADZUNA_APP_ID,
    ADZUNA_APP_KEY: process.env.ADZUNA_APP_KEY,
    JSEARCH_API_KEY: process.env.JSEARCH_API_KEY,
    REMOTIVE_API_BASE: process.env.REMOTIVE_API_BASE,
    UPLOADTHING_TOKEN: process.env.UPLOADTHING_TOKEN,
    UPLOADTHING_SECRET: process.env.UPLOADTHING_SECRET,
    UPLOADTHING_APP_ID: process.env.UPLOADTHING_APP_ID,
    UPLOADTHING_REGIONS: process.env.UPLOADTHING_REGIONS,
    DEV_CREDENTIALS_ENABLED: process.env.DEV_CREDENTIALS_ENABLED as 'true' | 'false' | undefined,
  });
  if (!parsed.success && !skip) {
    console.error('Invalid server environment:', parsed.error.flatten().fieldErrors);
    throw new Error('Invalid server environment variables');
  }
  if (skip) {
    return parsed.success ? parsed.data : ({} as ServerEnv);
  }
  return parsed.data!;
}

export const env = parseServer();

export function requireEnv<K extends keyof ServerEnv>(key: K): NonNullable<ServerEnv[K]> {
  const v = env[key];
  if (v === undefined || v === null || v === '') {
    throw new Error(`Missing required environment variable: ${String(key)}`);
  }
  return v as NonNullable<ServerEnv[K]>;
}
