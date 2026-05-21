import { NextResponse } from 'next/server';
import { prisma } from '@/server/db/prisma';
import { getSession } from '@/server/http/get-session';
import { handleApiError } from '@/server/errors/handler';
import { unauthorized } from '@/server/errors/http-error';
import { generateJsonText } from '@/server/ai/gemini';
import { logger } from '@/server/logger';

export const dynamic = 'force-dynamic';

const CACHE_TTL_DAYS = 7;
const PROMPT_KEY = 'career-goals-v1';
const PROMPT_VER = '1';

/** Static fallback career goal suggestions by role keyword. */
function fallbackGoals(currentRole: string): string[] {
  const r = currentRole.toLowerCase();
  if (r.includes('engineer') || r.includes('developer') || r.includes('frontend') || r.includes('backend') || r.includes('fullstack')) {
    return [
      'Become a Senior Software Engineer and lead architecture decisions on a high-impact product',
      'Transition into a Full Stack Engineering role and own end-to-end features',
      'Move toward Engineering Leadership as a Tech Lead or Staff Engineer',
    ];
  }
  if (r.includes('design') || r.includes('ux') || r.includes('ui')) {
    return [
      'Become a Lead Product Designer with ownership of the full design system',
      'Transition into a UX Research & Strategy role',
      'Build and lead a design team as a Design Manager',
    ];
  }
  if (r.includes('data') || r.includes('analyst') || r.includes('scientist')) {
    return [
      'Become a Senior Data Scientist and drive strategic business insights',
      'Transition to a Machine Learning Engineer role and deploy production models',
      'Move toward a Data Engineering or Analytics Engineering leadership role',
    ];
  }
  return [
    'Advance into a senior individual contributor role in my domain',
    'Develop cross-functional leadership skills and manage a team within 2 years',
    'Transition into a specialized or high-impact niche within my current field',
  ];
}

export async function POST() {
  try {
    const session = await getSession();
    if (!session?.user?.id) throw unauthorized();

    const profile = await prisma.profile.findUnique({ where: { userId: session.user.id } });

    const currentRole = profile?.currentRole ?? '';
    const skills = await prisma.userSkill.findMany({
      where: { userId: session.user.id },
      include: { skill: true },
      take: 10,
    });
    const skillLabels = skills.map(s => s.skill.label).filter(Boolean);

    // Hash-based cache key so regeneration is possible per role change
    const roleHash = Buffer.from(`${currentRole}:${skillLabels.join(',')}`).toString('base64').slice(0, 32);
    const cacheKey = `career-goal:${session.user.id}:${roleHash}`;

    // Check CachedAiResponse table
    const existing = await prisma.cachedAiResponse.findUnique({ where: { cacheKey } });
    if (existing && existing.expiresAt > new Date()) {
      const suggestions = (existing.response as { suggestions?: string[] })?.suggestions ?? fallbackGoals(currentRole);
      await prisma.cachedAiResponse.update({ where: { cacheKey }, data: { hitCount: { increment: 1 } } });
      return NextResponse.json({ ok: true, data: { suggestions, cached: true } });
    }

    // Try Gemini
    let suggestions: string[];
    try {
      const { text } = await generateJsonText({
        quality: 'balanced',
        system: 'You are a career coach. Respond with valid JSON only.',
        user: [
          `Current role: ${currentRole || 'Not specified'}`,
          `Skills: ${skillLabels.length > 0 ? skillLabels.join(', ') : 'Not specified'}`,
          `Experience: ${profile?.experienceYears || 'Not specified'}`,
          `Education: ${profile?.education?.slice(0, 200) || 'Not specified'}`,
          `Industry: ${profile?.preferredIndustry || 'Not specified'}`,
          '',
          'Generate exactly 3 realistic, inspiring career goal statements for this professional.',
          'Each should describe a clear trajectory above their current level.',
          'Return JSON: { "suggestions": ["...", "...", "..."] }',
        ].join('\n'),
        maxOutputTokens: 300,
      });

      const parsed = JSON.parse(text) as { suggestions?: string[] };
      suggestions = Array.isArray(parsed.suggestions) && parsed.suggestions.length >= 3
        ? parsed.suggestions.slice(0, 3)
        : fallbackGoals(currentRole);
    } catch (err) {
      logger.warn('career-goals generate: Gemini failed, using fallback', { err: String(err) });
      suggestions = fallbackGoals(currentRole);
    }

    // Cache result
    const expiresAt = new Date(Date.now() + CACHE_TTL_DAYS * 86400_000);
    try {
      await prisma.cachedAiResponse.upsert({
        where: { cacheKey },
        create: {
          cacheKey,
          promptKey: PROMPT_KEY,
          promptVer: PROMPT_VER,
          model: 'gemini',
          response: { suggestions },
          expiresAt,
          userId: session.user.id,
        },
        update: {
          response: { suggestions },
          expiresAt,
          hitCount: 0,
          updatedAt: new Date(),
        },
      });
    } catch (cacheErr) {
      logger.warn('career-goals cache write failed', { err: String(cacheErr) });
    }

    return NextResponse.json({ ok: true, data: { suggestions, cached: false } });
  } catch (e) {
    return handleApiError(e);
  }
}
