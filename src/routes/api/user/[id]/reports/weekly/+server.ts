import { createResponse } from '$lib/utils/response';
import {
    findExistingReport,
    getAthleteProfile,
    getReportGenerationCount,
    getRunningGoalsByIds,
    persistTrainingReport,
    ReportLimitReachedError,
} from '$lib/prisma/prisma';
import { fetchGarminActivities } from '$lib/server/garmin/fetch-activities';
import { computeWeeklyMetrics } from '$lib/server/analytics';
import { buildReportPrompt } from '$lib/server/reports/build-prompt';
import { callWeeklyReportProxy } from '$lib/server/reports/call-proxy';
import { validateBody, validateDates } from '$lib/server/reports/weekly-validation';
import { addDays } from '$lib/utils/iso-week';
import { partitionRunningActivities } from '$lib/utils/activity-type';
import { WEEKLY_REPORT_LIFETIME_LIMIT } from '@/constants/training-report.constants';
import type { AthleteProfile, Prisma, RunningGoal } from '@prisma/client';
import type { MetricsBundle } from '$lib/server/analytics/types';

const EMPTY_WEEK_SUMMARY = 'No activities were recorded for this period — no review generated.';

export async function POST({
    request,
    params,
    locals,
}: {
    request: Request;
    params: { id: string };
    locals: App.Locals;
}): Promise<Response> {
    const userId = params.id;

    if (userId !== locals.user?.id) {
        return createResponse(403, { message: 'Unauthorized' });
    }

    const body = await request.json();
    const bodyValidation = validateBody(body);
    if ('error' in bodyValidation) {
        return createResponse(400, { code: bodyValidation.code, message: bodyValidation.error });
    }
    const { periodStart, periodEnd, goalIds, notes, password, overwrite } = bodyValidation.value;

    const [profile, count, existing, goals] = await Promise.all([
        getAthleteProfile(userId),
        getReportGenerationCount(userId),
        findExistingReport(userId, 'WEEKLY', periodStart),
        goalIds.length > 0 ? getRunningGoalsByIds(userId, goalIds) : Promise.resolve([]),
    ]);

    if (!profile) {
        return createResponse(412, { code: 'PROFILE_REQUIRED', message: 'Athlete profile must be set up first' });
    }

    const dateValidation = validateDates(periodStart, periodEnd, profile.timezone);
    if ('error' in dateValidation) {
        return createResponse(400, { code: 'INVALID_PERIOD', message: dateValidation.error });
    }

    if (count >= WEEKLY_REPORT_LIFETIME_LIMIT) {
        return createResponse(403, {
            code: 'REPORT_LIMIT_REACHED',
            message: 'Weekly report generation limit reached',
        });
    }

    if (existing && !overwrite) {
        return createResponse(409, {
            code: 'REPORT_EXISTS',
            message: 'A report for this period already exists',
            existingId: existing.id,
        });
    }

    if (goals.length !== goalIds.length) {
        return createResponse(400, {
            code: 'INVALID_GOAL_IDS',
            message: 'One or more goal IDs are unknown or archived',
        });
    }

    const prevStart = addDays(periodStart, -7);
    const prevEnd = addDays(periodStart, -1);
    const [currentWeek, previousWeek] = await Promise.all([
        fetchGarminActivities({ userId, startDate: periodStart, endDate: periodEnd, password }),
        fetchGarminActivities({ userId, startDate: prevStart, endDate: prevEnd, password }),
    ]);
    if (!currentWeek.ok) {
        return createResponse(currentWeek.status, { code: currentWeek.code, message: currentWeek.message });
    }

    const previousWeekActivities = previousWeek.ok ? previousWeek.activities : null;

    const currentPartition = partitionRunningActivities(currentWeek.activities);
    const previousRunning = previousWeekActivities ? partitionRunningActivities(previousWeekActivities).running : null;

    const metrics: MetricsBundle = computeWeeklyMetrics({
        periodStart,
        periodEnd,
        activities: currentPartition.running,
        previousWeekActivities: previousRunning,
        crossTrainingActivities: currentPartition.crossTraining,
        hasHrZoneBounds: profile.hrZoneBounds != null,
    });

    const goalContext = buildGoalContext({ profile, goals, notes });
    const metricsJson = metrics as unknown as Prisma.InputJsonValue;
    const goalContextJson = goalContext as unknown as Prisma.InputJsonValue;

    if (metrics.flags.noActivities) {
        try {
            const report = await persistTrainingReport(
                {
                    userId,
                    type: 'WEEKLY',
                    periodStart,
                    periodEnd,
                    metrics: metricsJson,
                    summary: EMPTY_WEEK_SUMMARY,
                    goalContext: goalContextJson,
                },
                WEEKLY_REPORT_LIFETIME_LIMIT,
                { consumeSlot: false },
            );
            return createResponse(200, { data: report });
        } catch (err) {
            if (err instanceof ReportLimitReachedError) {
                return createResponse(403, {
                    code: 'REPORT_LIMIT_REACHED',
                    message: 'Weekly report generation limit reached',
                });
            }
            throw err;
        }
    }

    const prompt = buildReportPrompt({ metrics, profile, goals, notes });
    const proxy = await callWeeklyReportProxy(prompt);
    if (!proxy.ok || !proxy.summary) {
        return createResponse(502, { code: 'LLM_FAILED', message: proxy.error ?? 'LLM proxy failed' });
    }

    try {
        const report = await persistTrainingReport(
            {
                userId,
                type: 'WEEKLY',
                periodStart,
                periodEnd,
                metrics: metricsJson,
                summary: proxy.summary,
                goalContext: goalContextJson,
            },
            WEEKLY_REPORT_LIFETIME_LIMIT,
        );
        return createResponse(200, { data: report });
    } catch (err) {
        if (err instanceof ReportLimitReachedError) {
            return createResponse(403, {
                code: 'REPORT_LIMIT_REACHED',
                message: 'Weekly report generation limit reached',
            });
        }
        throw err;
    }
}

function buildGoalContext({
    profile,
    goals,
    notes,
}: {
    profile: AthleteProfile;
    goals: RunningGoal[];
    notes?: string;
}) {
    return {
        notes: notes ?? null,
        goals: goals.map((g) => ({
            id: g.id,
            goalType: g.goalType,
            targetEventName: g.targetEventName,
            targetEventDate: g.targetEventDate?.toISOString().slice(0, 10) ?? null,
            targetDistanceM: g.targetDistanceM,
            targetTimeSec: g.targetTimeSec,
            priority: g.priority,
            notes: g.notes,
        })),
        profileSnapshot: {
            birthDate: profile.birthDate.toISOString().slice(0, 10),
            sex: profile.sex,
            weightKg: Number(profile.weightKg),
            heightCm: profile.heightCm,
            timezone: profile.timezone,
            restingHR: profile.restingHR,
            maxHR: profile.maxHR,
            hrZoneBounds: profile.hrZoneBounds ?? null,
            vo2max: profile.vo2max != null ? Number(profile.vo2max) : null,
        },
    };
}
