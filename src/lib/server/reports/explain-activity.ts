import type { Activity, AthleteProfile } from '@prisma/client';
import type { MetricsLoadProfile } from '$lib/server/analytics/types';
import type { ActivityDetailPayload, ActivitySample, ActivitySplit } from '$lib/server/garmin/fetch-activity-detail';
import { ageFromBirthDate } from '$lib/utils/age';
import { hrZoneSecondsFromRow } from '$lib/utils/hr-zones';
import { isPaceActivityType, paceSecPerKmFromSpeed, formatPaceSecPerKm } from '$lib/utils/pace';

// Stored samples can be up to ~1000 points; the LLM can't usefully reason over that many
// raw datapoints and it blows up token cost + payload size. Downsample uniformly for prompting.
const SAMPLES_FOR_LLM_MAX = 120;

interface LlmSample {
    timestampSec: number;
    heartRate: number | null;
    // For run-type activities we send pre-computed pace (sec/km) so the model never converts
    // units; for other activities we send raw speed in m/s (explicit `Mps` suffix).
    paceSecPerKm?: number | null;
    speedMps?: number | null;
}

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
- If the athlete's question is not about this activity (e.g. unrelated chitchat), say so politely in one sentence and stop.

Data units:
- Pace is given directly as \`paceSecPerKm\`/\`avgPaceSecPerKm\` (seconds per kilometer) with a pre-formatted \`pace\`/\`avgPace\` string (e.g. "5:02 /km"). Use these as-is; do NOT compute pace yourself.
- Any field ending in \`Mps\` is a speed in meters/second. Distances are meters (\`...M\`), durations are seconds (\`...Sec\`), heart rate is bpm.`;

export function buildExplainPrompt(params: ExplainActivityParams): ExplainPrompt {
    const { question, activity, detail, recentActivities, loadProfile, profile } = params;

    const isPace = isPaceActivityType(activity.activityType);
    const avgPaceSecPerKm = isPace ? paceSecPerKmFromSpeed(activity.averageSpeed) : null;

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
            averageSpeedMps: activity.averageSpeed,
            ...(isPace
                ? { avgPaceSecPerKm, avgPace: formatPaceSecPerKm(avgPaceSecPerKm) }
                : {}),
            averageCadence: activity.averageCadence,
            avgStrideLength: activity.avgStrideLength,
            elevationGainM: activity.elevationGainM,
            elevationLossM: activity.elevationLossM,
            trimpLoad: activity.trimpLoad,
        },
        splits: (detail?.splits ?? []).map((s) => serializeSplitForLlm(s, isPace)),
        samples: downsampleSamplesForLLM(detail?.samples ?? [], isPace),
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
        JSON.stringify(userPayload),
        '```',
        '',
        'Answer per the system instructions.',
    ].join('\n');

    return { system: SYSTEM_PROMPT, user };
}

function downsampleSamplesForLLM(samples: ActivitySample[], isPace: boolean): LlmSample[] {
    if (samples.length === 0) return [];
    if (samples.length <= SAMPLES_FOR_LLM_MAX) return samples.map((s) => toLlmSample(s, isPace));

    const step = samples.length / SAMPLES_FOR_LLM_MAX;
    const result: LlmSample[] = [];
    for (let i = 0; i < SAMPLES_FOR_LLM_MAX; i++) {
        result.push(toLlmSample(samples[Math.floor(i * step)], isPace));
    }
    return result;
}

function toLlmSample(sample: ActivitySample, isPace: boolean): LlmSample {
    // Pace-type activities: send pace (sec/km) so the model reasons in the same unit it answers in.
    // Other activities (e.g. cycling): keep raw m/s, explicitly suffixed.
    if (isPace) {
        return {
            timestampSec: sample.timestampSec,
            heartRate: sample.heartRate,
            paceSecPerKm: paceSecPerKmFromSpeed(sample.speed),
        };
    }
    return {
        timestampSec: sample.timestampSec,
        heartRate: sample.heartRate,
        speedMps: sample.speed,
    };
}

function serializeSplitForLlm(split: ActivitySplit, isPace: boolean) {
    const base = {
        splitIndex: split.splitIndex,
        distanceM: split.distanceM,
        durationSec: split.durationSec,
        averageHr: split.averageHr,
        averageSpeedMps: split.averageSpeed,
        elevationGainM: split.elevationGainM,
        elevationLossM: split.elevationLossM,
    };
    if (!isPace) return base;
    const paceSecPerKm = splitPaceSecPerKm(split);
    return { ...base, paceSecPerKm, pace: formatPaceSecPerKm(paceSecPerKm) };
}

function splitPaceSecPerKm(split: ActivitySplit): number | null {
    const fromSpeed = paceSecPerKmFromSpeed(split.averageSpeed);
    if (fromSpeed != null) return fromSpeed;
    // Fall back to distance/duration when Garmin omits per-lap speed.
    if (split.distanceM > 0 && split.durationSec > 0) {
        return Math.round((split.durationSec / split.distanceM) * 1000);
    }
    return null;
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
