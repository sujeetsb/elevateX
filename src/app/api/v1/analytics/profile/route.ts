import { NextResponse } from 'next/server';
import { getSession } from '@/server/http/get-session';
import { handleApiError } from '@/server/errors/handler';
import { unauthorized } from '@/server/errors/http-error';
import { getProfileAnalytics } from '@/server/services/profile-analytics.service';
import { cacheService } from '@/server/cache/cache-service';
import { cacheKeys } from '@/server/cache/cache-keys';

export const dynamic = 'force-dynamic';

const CACHE_TTL_SEC = 120;

export async function GET() {
  try {
    const session = await getSession();
    if (!session?.user?.id) throw unauthorized();

    const key = cacheKeys.profileAnalytics(session.user.id);
    const cached = await cacheService.getJson<Awaited<ReturnType<typeof getProfileAnalytics>>>(key);
    if (cached) {
      return NextResponse.json({ ok: true, source: 'cache', data: cached });
    }

    const data = await getProfileAnalytics(session.user.id);
    await cacheService.setJson(key, data, CACHE_TTL_SEC);
    return NextResponse.json({ ok: true, source: 'db', data });
  } catch (e) {
    return handleApiError(e);
  }
}
