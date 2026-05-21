import { JobSource } from '@prisma/client';
import type { NormalizedJob } from './types';

type RemotiveApi = { jobs: { id: number; title: string; company_name: string; candidate_required_location?: string; description?: string; url: string; publication_date?: string; salary?: string }[] };

export async function fetchRemotiveNormalized(): Promise<NormalizedJob[]> {
  const res = await fetch('https://remotive.com/api/remote-jobs?category=software-dev', {
    headers: { Accept: 'application/json' },
    next: { revalidate: 3600 },
  });
  if (!res.ok) return [];
  const data = (await res.json()) as RemotiveApi;
  return (data.jobs ?? []).slice(0, 40).map(j => ({
    source: JobSource.REMOTIVE,
    externalId: String(j.id),
    title: j.title,
    company: j.company_name,
    location: j.candidate_required_location ?? 'Remote',
    description: j.description?.slice(0, 4000) ?? null,
    url: j.url,
    salaryMin: null,
    salaryMax: null,
    currency: 'USD',
    postedAt: j.publication_date ? new Date(j.publication_date) : null,
    metadata: { provider: 'remotive', salaryText: j.salary ?? null },
  }));
}
