import { resumeParseFn } from './resume-parse';
import { jobSyncFn } from './job-sync';
import { recommendationsRefreshFn } from './recommendations-refresh';
import { jobSyncCronFn } from './job-sync-cron';
import { recommendationsRefreshCronFn } from './recommendations-refresh-cron';
import { roadmapGenerateFn } from './roadmap-generate';

export const inngestFunctions = [
  resumeParseFn,
  jobSyncFn,
  recommendationsRefreshFn,
  jobSyncCronFn,
  recommendationsRefreshCronFn,
  roadmapGenerateFn,
];
