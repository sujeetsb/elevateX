import { JobSource } from '@prisma/client';
import { env } from '@/lib/server-env';
import type { NormalizedJob } from './types';

/** Adzuna public API — https://developer.adzuna.com */
export async function fetchAdzunaNormalized(query: string): Promise<NormalizedJob[]> {
  const appId = env.ADZUNA_APP_ID;
  const appKey = env.ADZUNA_APP_KEY;
  if (!appId || !appKey) return [];

  const params = new URLSearchParams({
    app_id: appId,
    app_key: appKey,
    results_per_page: '25',
    what: query,
    'content-type': 'application/json',
  });
  const res = await fetch(`https://api.adzuna.com/v1/api/jobs/us/search/1?${params}`, { next: { revalidate: 1800 } });
  if (!res.ok) return [];
  const data = (await res.json()) as {
    results?: {
      id: string;
      title: string;
      company?: { display_name?: string };
      location?: { display_name?: string }[];
      description?: string;
      redirect_url?: string;
      salary_min?: number;
      salary_max?: number;
      created?: string;
    }[];
  };
  return (data.results ?? []).map(r => ({
    source: JobSource.ADZUNA,
    externalId: String(r.id),
    title: r.title,
    company: r.company?.display_name ?? 'Unknown',
    location: r.location?.[0]?.display_name ?? null,
    description: r.description?.replace(/<[^>]+>/g, ' ').slice(0, 4000) ?? null,
    url: r.redirect_url ?? '',
    salaryMin: r.salary_min ?? null,
    salaryMax: r.salary_max ?? null,
    currency: 'USD',
    postedAt: r.created ? new Date(r.created) : null,
    metadata: { provider: 'adzuna' },
  }));
}
