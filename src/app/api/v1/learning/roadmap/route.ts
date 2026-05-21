import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { z } from 'zod';
import { prisma } from '@/server/db/prisma';
import { getSession } from '@/server/http/get-session';
import { handleApiError } from '@/server/errors/handler';
import { unauthorized } from '@/server/errors/http-error';

export const dynamic = 'force-dynamic';

const resourceIdSchema = z.string();

type JsonPlanShape = {
  title: string;
  weeks?: number;
  modules?: Array<{
    title: string;
    resources?: Array<{
      title: string;
      url: string;
      provider: string;
    }>;
  }>;
};

function sha256Hex(s: string): string {
  return crypto.createHash('sha256').update(s, 'utf8').digest('hex');
}

export async function GET() {
  try {
    const session = await getSession();
    if (!session?.user?.id) throw unauthorized();

    const roadmap = await prisma.learningRoadmap.findFirst({
      where: { userId: session.user.id, deletedAt: null },
      orderBy: { updatedAt: 'desc' },
    });

    if (!roadmap) {
      return NextResponse.json({ ok: true, data: null });
    }

    const jsonPlan = (roadmap.jsonPlan ?? null) as JsonPlanShape | null;
    const modules = jsonPlan?.modules ?? [];

    // LearningProgress.resourceId is expected to be derived from the resource fields.
    // For now we compute deterministic ids from the active jsonPlan to make UI mapping stable.
    const resources = modules.flatMap(m =>
      (m.resources ?? []).map(r => ({
        resourceId: resourceIdSchema.parse(sha256Hex(`${r.provider}|${r.url}|${r.title}`)),
        moduleTitle: m.title,
        title: r.title,
        url: r.url,
        provider: r.provider,
      })),
    );

    const progressRows = await prisma.learningProgress.findMany({
      where: { userId: session.user.id },
      select: {
        roadmapId: true,
        resourceId: true,
        title: true,
        provider: true,
        completed: true,
        progressPct: true,
        resourceUrl: true,
      },
    });

    const progressByResourceId = new Map<string, { completed: boolean; progressPct: number }>();
    for (const p of progressRows) {
      if (!p.resourceId) continue;
      progressByResourceId.set(p.resourceId, { completed: p.completed, progressPct: p.progressPct });
    }

    const completedCount = resources.reduce((acc, r) => {
      const p = progressByResourceId.get(r.resourceId);
      return acc + (p?.completed ? 1 : 0);
    }, 0);

    const progressPct = resources.length ? Math.round((completedCount / resources.length) * 100) : 0;

    return NextResponse.json({
      ok: true,
      data: {
        roadmap: {
          id: roadmap.id,
          title: roadmap.title,
          summary: roadmap.summary,
          jsonPlan,
          status: roadmap.status,
          targetRole: roadmap.targetRole,
          createdAt: roadmap.createdAt,
          updatedAt: roadmap.updatedAt,
        },
        resources,
        progress: {
          progressPct,
          completedCount,
          totalCount: resources.length,
          byResourceId: Object.fromEntries(
            Array.from(progressByResourceId.entries()).map(([resourceId, v]) => [resourceId, v]),
          ),
        },
      },
    });
  } catch (e) {
    return handleApiError(e);
  }
}

