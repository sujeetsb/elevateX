/**
 * UploadThing v7 reads `UPLOADTHING_TOKEN`: base64(JSON.stringify({
 *   apiKey: string  // must start with sk_
 *   appId: string
 *   regions: string[]  // e.g. ["sea1"] — see https://docs.uploadthing.com/concepts/regions-acl
 * }))
 *
 * Dashboard copy-paste is `UPLOADTHING_TOKEN`. Legacy setups often use `UPLOADTHING_SECRET` + `UPLOADTHING_APP_ID`; we synthesize a valid token from those.
 */

function trimEnv(v: string | undefined): string | undefined {
  if (v == null) return undefined;
  const t = v.trim();
  if (!t) return undefined;
  return t.replace(/^['"]|['"]$/g, '');
}

function parseRegions(): string[] {
  const raw = trimEnv(process.env.UPLOADTHING_REGIONS);
  if (!raw) return ['sea1'];
  const parts = raw
    .split(/[\s,]+/)
    .map(r => r.trim())
    .filter(Boolean);
  return parts.length ? parts : ['sea1'];
}

export function tryDecodeDashboardToken(encoded: string): boolean {
  try {
    const json = Buffer.from(encoded, 'base64').toString('utf8');
    const o = JSON.parse(json) as { apiKey?: unknown; appId?: unknown; regions?: unknown };
    return (
      typeof o.apiKey === 'string' &&
      o.apiKey.startsWith('sk_') &&
      typeof o.appId === 'string' &&
      o.appId.length > 0 &&
      Array.isArray(o.regions) &&
      o.regions.length > 0 &&
      o.regions.every(r => typeof r === 'string')
    );
  } catch {
    return false;
  }
}

function encodeToken(apiKey: string, appId: string, regions: string[]): string {
  const payload = { apiKey, appId, regions };
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64');
}

/**
 * Resolves the v7 server token for UploadThing (route handler + UTApi).
 */
export function getUploadThingToken(): string {
  const token = trimEnv(process.env.UPLOADTHING_TOKEN);
  const secret = trimEnv(process.env.UPLOADTHING_SECRET);
  const appId = trimEnv(process.env.UPLOADTHING_APP_ID);

  if (token && tryDecodeDashboardToken(token)) {
    return token;
  }

  const apiKeyFromSecretField = secret?.startsWith('sk_') ? secret : undefined;
  const apiKeyFromTokenField = token?.startsWith('sk_') ? token : undefined;
  const apiKey = apiKeyFromTokenField ?? apiKeyFromSecretField;

  if (apiKey && appId) {
    return encodeToken(apiKey, appId, parseRegions());
  }

  if (token) {
    throw new Error(
      'UPLOADTHING_TOKEN is set but is not a valid v7 token (expected base64 JSON with apiKey, appId, regions). Copy the full token from the UploadThing dashboard, or use UPLOADTHING_SECRET (sk_…) + UPLOADTHING_APP_ID.',
    );
  }

  throw new Error(
    'UploadThing: set UPLOADTHING_TOKEN from the dashboard (API Keys → copy token), or set UPLOADTHING_SECRET (sk_…) + UPLOADTHING_APP_ID. Optional: UPLOADTHING_REGIONS=sea1 (comma-separated).',
  );
}
