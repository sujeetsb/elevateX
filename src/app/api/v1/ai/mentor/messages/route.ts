import { NextResponse } from 'next/server';
import { z } from 'zod';
import { Prisma, AiConversationType, ActivityVerb } from '@prisma/client';
import { prisma } from '@/server/db/prisma';
import { getSession } from '@/server/http/get-session';
import { handleApiError } from '@/server/errors/handler';
import { unauthorized } from '@/server/errors/http-error';
import { chatAssistantSystem } from '@/server/ai/prompts/registry';
import { generateText } from '@/server/ai/gemini';
import { logger } from '@/server/logger';
import { enforceRateLimit } from '@/server/rate-limit/upstash-route';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  content: z.string().min(1).max(8000),
  conversationId: z.string().min(1).optional(),
});

function safeJson(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

function safeStringList(v: unknown, max = 20): string[] {
  if (!Array.isArray(v)) return [];
  return v.map(x => String(x).trim()).filter(Boolean).slice(0, max);
}

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session?.user?.id) throw unauthorized();

    await enforceRateLimit(`user:${session.user.id}:mentor.messages`, { limit: 25, window: '60 m' });

    const body = bodySchema.parse(await req.json());
    const userId = session.user.id;

    // Determine or create conversation.
    const conversation = await (async () => {
      if (body.conversationId) {
        const existing = await prisma.aiConversation.findFirst({
          where: { id: body.conversationId, userId, type: AiConversationType.MENTOR },
        });
        if (existing) return existing;
      }
      const firstLine = body.content.split('\n')[0]?.slice(0, 60) ?? 'Mentor chat';
      return prisma.aiConversation.create({
        data: { userId, type: AiConversationType.MENTOR, title: firstLine },
      });
    })();

    // Persist user message.
    const createdUserMessage = await prisma.aiMessage.create({
      data: { conversationId: conversation.id, role: 'user', content: body.content },
    });

    // Load rich context from DB in parallel.
    const [latestResume, profile, activeRoadmap, recentMessages, userSkills, aiRecs] = await Promise.all([
      prisma.resume.findFirst({
        where: { userId, deletedAt: null, parseStatus: 'COMPLETE' },
        orderBy: { updatedAt: 'desc' },
        select: { parsedJson: true, atsScore: true },
      }),
      prisma.profile.findUnique({
        where: { userId },
        select: { currentRole: true, targetRole: true, bio: true, careerGoal: true, experienceYears: true, preferredIndustry: true },
      }),
      prisma.learningRoadmap.findFirst({
        where: { userId, status: 'ACTIVE', deletedAt: null },
        orderBy: { updatedAt: 'desc' },
        select: { title: true, targetRole: true, summary: true, jsonPlan: true },
      }),
      prisma.aiMessage.findMany({
        where: { conversationId: conversation.id },
        orderBy: { createdAt: 'asc' },
        take: 10,
        select: { id: true, role: true, content: true },
      }),
      prisma.userSkill.findMany({
        where: { userId },
        include: { skill: true },
        take: 30,
      }),
      prisma.aiRecommendation.findMany({
        where: { userId, promptKey: { startsWith: 'resume.pipeline' } },
        orderBy: { score: 'desc' },
        take: 5,
        select: { rationale: true, payload: true },
      }),
    ]);

    // ---- Compile user context ----
    const parsedResume = safeJson(latestResume?.parsedJson) ? latestResume!.parsedJson as Record<string, unknown> : null;
    const atsScore = latestResume?.atsScore ?? null;

    const resumeSkills = safeStringList(parsedResume?.skills, 30);
    const skillLabels = userSkills.map(s => s.skill.label).slice(0, 20);
    const allSkills = [...new Set([...resumeSkills, ...skillLabels])].slice(0, 30);

    const targetRole = profile?.targetRole
      ?? safeStringList(parsedResume?.targetRolesSuggested)[0]
      ?? 'Not specified';

    const gaps = safeStringList(parsedResume?.gaps, 8);
    const strengths = safeStringList(parsedResume?.strengths, 6);
    const careerLevel = typeof parsedResume?.careerLevel === 'string' ? parsedResume.careerLevel : null;
    const headline = typeof parsedResume?.headline === 'string' ? parsedResume.headline : null;
    const careerObjective = typeof parsedResume?.careerObjective === 'string' ? parsedResume.careerObjective : null;

    const roadmapModuleTitles: string[] = [];
    const roadmapMilestones: string[] = [];
    if (activeRoadmap?.jsonPlan && safeJson(activeRoadmap.jsonPlan)) {
      const plan = activeRoadmap.jsonPlan as Record<string, unknown>;
      const modules = Array.isArray(plan.modules) ? plan.modules as unknown[] : [];
      roadmapModuleTitles.push(
        ...modules
          .filter((m): m is Record<string, unknown> => safeJson(m))
          .map(m => String(m.title ?? ''))
          .filter(Boolean)
          .slice(0, 6),
      );
      const ms = Array.isArray(plan.milestones) ? plan.milestones as unknown[] : [];
      roadmapMilestones.push(...ms.map(m => String(m)).filter(Boolean).slice(0, 5));
    }

    const resumeGapRecs = aiRecs
      .map(r => {
        const p = safeJson(r.payload) ? r.payload as Record<string, unknown> : null;
        return p ? String(p.gap ?? r.rationale ?? '') : r.rationale ?? '';
      })
      .filter(Boolean)
      .slice(0, 4);

    // ---- Conversation history ----
    const lastMessages = recentMessages
      .filter(m => m.id !== createdUserMessage.id)
      .slice(-8)
      .map(m => `${m.role === 'user' ? 'User' : 'Mentor'}: ${m.content}`)
      .join('\n');

    // ---- Build rich prompt ----
    const contextLines = [
      '## USER PROFILE',
      `- Name/role: ${profile?.currentRole ?? headline ?? 'Unknown'}`,
      `- Target role: ${targetRole}`,
      `- Experience: ${profile?.experienceYears ?? 'Unknown'} years`,
      careerLevel ? `- Career level: ${careerLevel}` : '',
      profile?.preferredIndustry ? `- Industry: ${profile.preferredIndustry}` : '',
      profile?.careerGoal ? `- Career goal: ${profile.careerGoal}` : '',
      careerObjective ? `- Objective: ${careerObjective}` : '',
      profile?.bio ? `- Bio: ${profile.bio.slice(0, 200)}` : '',
      '',
      '## ATS & SKILLS',
      `- ATS score: ${typeof atsScore === 'number' ? `${atsScore}/100` : 'Not yet analyzed'}`,
      allSkills.length ? `- Skills (${allSkills.length}): ${allSkills.join(', ')}` : '',
      gaps.length ? `- Skill gaps: ${gaps.join(', ')}` : '',
      strengths.length ? `- Strengths: ${strengths.join(', ')}` : '',
      resumeGapRecs.length ? `- Top improvement areas: ${resumeGapRecs.join('; ')}` : '',
      '',
      activeRoadmap ? '## LEARNING ROADMAP' : '',
      activeRoadmap ? `- Roadmap: ${activeRoadmap.title ?? 'Active roadmap'} (${activeRoadmap.summary ?? ''})` : '',
      roadmapModuleTitles.length ? `- Modules: ${roadmapModuleTitles.join(' → ')}` : '',
      roadmapMilestones.length ? `- Milestones: ${roadmapMilestones.join('; ')}` : '',
    ].filter(Boolean).join('\n');

    const promptUser = [
      lastMessages ? `## CONVERSATION HISTORY\n${lastMessages}` : '',
      '',
      `## USER MESSAGE\n${body.content}`,
      '',
      contextLines,
      '',
      '## INSTRUCTIONS\nRespond as an expert career mentor. Reference the user\'s actual data above. Structure your answer with: quick diagnosis → specific actionable steps (2-4 bullets) → optional follow-up question.',
    ].filter(Boolean).join('\n');

    logger.info('mentor.chat.generate', { userId, conversationId: conversation.id, skillCount: allSkills.length, hasResume: !!parsedResume });

    const { text } = await generateText({
      system: chatAssistantSystem(),
      user: promptUser,
      quality: 'balanced',
      maxRetries: 2,
      maxOutputTokens: 1200,
      temperature: 0.45,
    });

    const assistantMessage = await prisma.aiMessage.create({
      data: { conversationId: conversation.id, role: 'assistant', content: text },
    });

    await prisma.activityLog.create({
      data: {
        userId,
        verb: ActivityVerb.AI_CHAT,
        subject: conversation.id,
        metadata: {
          userMessageId: createdUserMessage.id,
          assistantMessageId: assistantMessage.id,
        } as Prisma.InputJsonValue,
      },
    });

    const tokenEstimate = Math.max(1, Math.round((body.content.length + text.length) / 4));
    await prisma.userAnalytics.upsert({
      where: { userId },
      create: { userId, aiTokensMonth: tokenEstimate },
      update: { aiTokensMonth: { increment: tokenEstimate } },
    });

    return NextResponse.json({
      ok: true,
      data: {
        conversationId: conversation.id,
        message: { id: assistantMessage.id, role: 'assistant', content: assistantMessage.content },
      },
    });
  } catch (e) {
    return handleApiError(e);
  }
}
