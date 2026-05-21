import type { JobSource } from '@prisma/client';

export type NormalizedJob = {
  source: JobSource;
  externalId: string;
  title: string;
  company: string;
  location: string | null;
  description: string | null;
  url: string;
  salaryMin: number | null;
  salaryMax: number | null;
  currency: string | null;
  postedAt: Date | null;
  metadata: Record<string, unknown>;
};
