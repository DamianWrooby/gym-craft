import { m } from '$lib/paraglide/messages.js';
import { createResponse } from '$lib/utils/response';
import { db } from '$lib/database';
import { ensureActivityDetail } from '$lib/server/garmin/ensure-activity-detail';
import { buildExplainPrompt } from '$lib/server/reports/explain-activity';
import { activityTypeSupportsAiCoach } from '$lib/utils/activity-type';
import { callExplainRunProxy } from '$lib/server/reports/call-proxy';
import { computeLoadProfile } from '$lib/server/analytics/load';
import { EXPLAIN_QUESTION_MAX_LENGTH } from '@/constants/training-report.constants';
import { getLimit } from '@/constants/subscription.constants';
import { toIsoDate } from '$lib/utils/iso-week';
import { mapProfileSex } from '$lib/server/analytics/load/trimp';

const RECENT_WINDOW_DAYS = 14;

export async function POST({
    request,
    params,
    locals,
}: {
    request: Request;
    params: { id: string; activityId: string };
    locals: App.Locals;
}): Promise<Response> {
    const userId = params.id;
    const activityId = params.activityId;

    if (userId !== locals.user?.id) {
        return createResponse(403, { message: m.api_unauthorized() });
    }

    const body = await request.json().catch(() => null);
    const question = typeof body?.question === 'string' ? body.question.trim() : '';
    if (!question) {
        return createResponse(400, { code: 'QUESTION_REQUIRED', message: m.api_question_required() });
    }
    if (question.length > EXPLAIN_QUESTION_MAX_LENGTH) {
        return createResponse(400, {
            code: 'QUESTION_TOO_LONG',
            message: m.ask_question_too_long({ max: EXPLAIN_QUESTION_MAX_LENGTH }),
        });
    }

    const today = toIsoDate(new Date());
    const usageKey = { userId_kind_day: { userId, kind: 'explain_run', day: today } };

    const [usage, activity] = await Promise.all([
        db.aiUsage.findUnique({ where: usageKey }),
        db.activity.findFirst({
            where: { id: activityId, userId },
            include: { detail: true },
        }),
    ]);

    const explainLimit = getLimit(locals.user.subscriptionTier, 'explainRunsPerDay');
    if ((usage?.count ?? 0) >= explainLimit) {
        return createResponse(429, {
            code: 'EXPLAIN_LIMIT_REACHED',
            message: m.api_explain_limit({ limit: explainLimit }),
        });
    }
    if (!activity) {
        return createResponse(404, { code: 'ACTIVITY_NOT_FOUND', message: m.api_activity_not_found() });
    }
    if (!activityTypeSupportsAiCoach(activity.activityType)) {
        return createResponse(400, {
            code: 'ACTIVITY_TYPE_NOT_SUPPORTED',
            message: m.api_coach_running_only(),
        });
    }

    const ensured = await ensureActivityDetail(userId, activity);
    if (!ensured.ok) {
        return createResponse(ensured.status, { code: ensured.code, message: ensured.message });
    }
    const detailPayload = ensured.detail;

    const recentWindowStart = new Date();
    recentWindowStart.setUTCDate(recentWindowStart.getUTCDate() - RECENT_WINDOW_DAYS);
    const [recentActivities, profile] = await Promise.all([
        db.activity.findMany({
            where: { userId, startTime: { gte: recentWindowStart, lt: activity.startTime } },
            orderBy: { startTime: 'desc' },
            select: {
                startTime: true,
                activityType: true,
                durationSec: true,
                distanceM: true,
                averageHr: true,
                trimpLoad: true,
            },
        }),
        db.athleteProfile.findUnique({ where: { userId } }),
    ]);

    let loadProfile = null;
    if (profile) {
        try {
            loadProfile = await computeLoadProfile(userId, activity.startTime, {
                restingHR: profile.restingHR,
                maxHR: profile.maxHR,
                sex: mapProfileSex(profile.sex),
            });
        } catch (err) {
            console.warn(`[explain-run] load profile failed for user ${userId}: ${(err as Error).message}`);
        }
    }

    const prompt = buildExplainPrompt({
        question,
        activity,
        detail: detailPayload,
        recentActivities,
        loadProfile,
        profile,
    });

    const proxy = await callExplainRunProxy(prompt, locals.user.aiModel);
    if (!proxy.ok || !proxy.analysis) {
        // proxy.error carries OpenAI's own wording — diagnostics, not copy. Log it, show our own.
        console.error(`[explain-run] proxy failed for user ${userId}: ${proxy.error}`);
        return createResponse(502, { code: 'LLM_FAILED', message: m.api_ai_unavailable() });
    }

    await db.aiUsage.upsert({
        where: usageKey,
        create: { userId, kind: 'explain_run', day: today, count: 1 },
        update: { count: { increment: 1 } },
    });

    return createResponse(200, { data: { analysis: proxy.analysis } });
}
