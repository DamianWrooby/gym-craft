import type { Activity, AthleteProfile } from '@prisma/client';
import type { MetricsLoadProfile } from '$lib/server/analytics/types';
import type { ActivityDetailPayload } from '$lib/server/garmin/fetch-activity-detail';
import { ageFromBirthDate } from '$lib/utils/age';
import { hrZoneSecondsFromRow } from '$lib/utils/hr-zones';

export interface ExplainActivityParams {
    question: string;
    activity: Pick<
        Activity,
        | 'garminActivityId'
        | 'activityType'
        | 'activityName'
        | 'startTime'
        | 'durationSec'
        | 'distanceM'
        | 'averageHr'
        | 'maxHr'
        | 'hrZone1Sec'
        | 'hrZone2Sec'
        | 'hrZone3Sec'
        | 'hrZone4Sec'
        | 'hrZone5Sec'
        | 'averageSpeed'
        | 'averageCadence'
        | 'avgStrideLength'
        | 'elevationGainM'
        | 'elevationLossM'
        | 'trimpLoad'
    >;
    detail: ActivityDetailPayload | null;
    recentActivities: Array<
        Pick<Activity, 'startTime' | 'activityType' | 'durationSec' | 'distanceM' | 'averageHr' | 'trimpLoad'>
    >;
    loadProfile: MetricsLoadProfile | null;
    profile: AthleteProfile | null;
}

export interface ExplainPrompt {
    system: string;
    user: string;
}

const SYSTEM_PROMPT = `You are an expert endurance running coach. The athlete has just asked a specific question about ONE of their activities. You are looking at the activity's full data (overall stats, splits, sample-level HR/pace over time) plus their last 14 days of training and their current training-load profile.

Your job:
- Answer the athlete's question directly and concretely, grounded ONLY in the data provided.
- Reference specific splits, time ranges, or numbers from the activity when they support your answer (e.g. "splits 4–6 averaged 5:12/km while HR climbed from 158 to 168").
- Cross-reference the athlete's recent training load and fatigue state when relevant ("your acute load was already 18% above chronic before this run").
- If the data does not support a confident answer, say so. Do not speculate beyond what the numbers show.
- Be specific, not generic. Avoid phrases like "train smart", "listen to your body", "stay consistent" — those are filler.

Hard rules:
- 3 to 5 short paragraphs maximum, total under 400 words.
- Do NOT diagnose injuries or give medical advice. Frame physical observations as training-load and recovery signals only.
- Do NOT recommend stopping training entirely.
- Do NOT invent metrics that are not in the data. If splits are empty, do not pretend you have split data.
- If the athlete's question is not about this activity (e.g. unrelated chitchat), say so politely in one sentence and stop.`;

export function buildExplainPrompt(params: ExplainActivityParams): ExplainPrompt {
    const { question, activity, detail, recentActivities, loadProfile, profile } = params;

    const userPayload = {
        question,
        activity: {
            garminActivityId: activity.garminActivityId.toString(),
            activityType: activity.activityType,
            activityName: activity.activityName,
            startTime: activity.startTime.toISOString(),
            durationSec: activity.durationSec,
            distanceM: activity.distanceM,
            averageHr: activity.averageHr,
            maxHr: activity.maxHr,
            hrZoneSeconds: hrZoneSecondsFromRow(activity),
            averageSpeed: activity.averageSpeed,
            averageCadence: activity.averageCadence,
            avgStrideLength: activity.avgStrideLength,
            elevationGainM: activity.elevationGainM,
            elevationLossM: activity.elevationLossM,
            trimpLoad: activity.trimpLoad,
        },
        splits: detail?.splits ?? [],
        samples: detail?.samples ?? [],
        sampleCount: detail?.samples?.length ?? 0,
        recentActivitiesLast14d: recentActivities.map((a) => ({
            startTime: a.startTime.toISOString(),
            activityType: a.activityType,
            durationSec: a.durationSec,
            distanceM: a.distanceM,
            averageHr: a.averageHr,
            trimpLoad: a.trimpLoad,
        })),
        loadProfile,
        athlete: profile ? serializeProfile(profile) : null,
    };

    const user = [
        `Athlete's question: ${question}`,
        '',
        'Activity + context data (JSON):',
        '```json',
        JSON.stringify(userPayload, null, 2),
        '```',
        '',
        'Answer per the system instructions.',
    ].join('\n');

    return { system: SYSTEM_PROMPT, user };
}

function serializeProfile(profile: AthleteProfile) {
    return {
        age: ageFromBirthDate(profile.birthDate),
        sex: profile.sex,
        weightKg: Number(profile.weightKg),
        heightCm: profile.heightCm,
        restingHR: profile.restingHR,
        maxHR: profile.maxHR,
        hrZoneBoundsConfigured: profile.hrZoneBounds != null,
        vo2max: profile.vo2max != null ? Number(profile.vo2max) : null,
    };
}

