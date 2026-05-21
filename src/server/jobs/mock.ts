import { JobSource } from '@prisma/client';
import type { NormalizedJob } from './types';

export function mockNormalizedJobs(): NormalizedJob[] {
  const now = new Date();
  return [
    {
      source: JobSource.MOCK,
      externalId: 'mock-1',
      title: 'Senior Frontend Engineer',
      company: 'Notion',
      location: 'Remote',
      description: 'React, TypeScript, design systems.',
      url: 'https://example.com/jobs/mock-1',
      salaryMin: 160_000,
      salaryMax: 200_000,
      currency: 'USD',
      postedAt: now,
      metadata: { mock: true },
    },
    {
      source: JobSource.MOCK,
      externalId: 'mock-2',
      title: 'Staff Engineer — UI Platform',
      company: 'Linear',
      location: 'Remote',
      description: 'Performance, React, GraphQL.',
      url: 'https://example.com/jobs/mock-2',
      salaryMin: 170_000,
      salaryMax: 210_000,
      currency: 'USD',
      postedAt: now,
      metadata: { mock: true },
    },
  ];
}
