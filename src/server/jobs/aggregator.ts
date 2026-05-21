import type { NormalizedJob } from './types';
import { fetchRemotiveNormalized } from './remotive';
import { fetchAdzunaNormalized } from './adzuna';
import { mockNormalizedJobs } from './mock';

function dedupeByUrl(jobs: NormalizedJob[]): NormalizedJob[] {
  const seen = new Set<string>();
  const out: NormalizedJob[] = [];
  for (const j of jobs) {
    const k = `${j.source}:${j.externalId}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(j);
  }
  return out;
}

export async function aggregateRemoteJobs(): Promise<NormalizedJob[]> {
  const [remotive, adzuna] = await Promise.all([
    fetchRemotiveNormalized().catch(() => []),
    fetchAdzunaNormalized('software engineer').catch(() => []),
  ]);
  const merged = [...remotive, ...adzuna, ...mockNormalizedJobs()];
  return dedupeByUrl(merged);
}
