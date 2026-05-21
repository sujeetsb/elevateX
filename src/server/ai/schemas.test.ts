import { describe, it, expect } from 'vitest';
import { resumeAnalyzeResultSchema } from './schemas';

describe('resumeAnalyzeResultSchema', () => {
  it('accepts coerced ats score', () => {
    const parsed = resumeAnalyzeResultSchema.parse({
      atsScore: '82',
      summary: 'ok',
      skills: ['a'],
      gaps: [],
      bullets: ['b'],
    });
    expect(parsed.atsScore).toBe(82);
  });
});
