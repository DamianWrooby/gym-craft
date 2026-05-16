import type { AthleteProfile, RunningGoal } from '@prisma/client';
import type { MetricsBundle } from '$lib/server/analytics/types';
import { GOAL_TYPE_LABELS } from '@/constants/training-report.constants';

export interface BuildPromptParams {
    metrics: MetricsBundle;
    profile: AthleteProfile;
    goals: RunningGoal[];
    notes?: string;
}

export interface ReportPrompt {
    system: string;
    user: string;
}

const SYSTEM_PROMPT = `You are an endurance running coach writing a weekly training review for an amateur athlete.

Your tone is supportive, specific, and grounded in the data provided. You explain what the numbers mean rather than restating them. You point out trends, deviations, and what the athlete should think about next week — but you never invent numbers and you never give medical advice.

The "metrics" block (volume, intensity, efficiency, deltas) is RUNNING-ONLY. The "crossTraining" block summarizes non-running sessions in the same week (gym, cycling, swimming, etc.). Factor cross-training into overall training load, recovery, and the recommendations in "Looking ahead", but do not mix it into the running volume/pace/HR analysis.

Write the review in markdown with these sections:
1. **Summary** — one or two sentences capturing the headline of the week.
2. **Volume & consistency** — what the running distribution across the week reveals.
3. **Intensity quality** — how the running time-in-zones (if available) reflects training balance.
4. **Efficiency & response** — what running pace, HR, and any week-over-week deltas suggest.
5. **Looking ahead** — concrete, conservative recommendations for the next week, accounting for cross-training load.

Rules:
- If a metric is null or missing, do not speculate about it. Acknowledge the gap briefly if relevant.
- If HR zone bounds are not configured for the athlete, qualify any zone-based interpretation as relative ("roughly half of training time was at low intensity") rather than absolute.
- If cross-training is present, mention it briefly when it affects load or recovery — otherwise ignore it.
- Reference the athlete's goals when shaping the "Looking ahead" section.
- Keep the review under 350 words.
- Do not include disclaimers or apologies.`;

export function buildReportPrompt(params: BuildPromptParams): ReportPrompt {
    const { metrics, profile, goals, notes } = params;

    const userPayload = {
        period: metrics.period,
        athlete: serializeProfile(profile),
        goals: goals.map(serializeGoal),
        notes: notes ?? null,
        metrics: {
            volume: metrics.volume,
            intensity: metrics.intensity,
            efficiency: {
                averagePaceSecPerKm: metrics.efficiency.averagePaceSecPerKm,
                averageHR: metrics.efficiency.averageHR,
                activityCount: metrics.efficiency.perActivity.length,
            },
            deltas: metrics.deltas,
            flags: metrics.flags,
        },
        crossTraining: metrics.crossTraining ?? null,
    };

    const user = [
        'Here is this week\'s training data. Generate the weekly review per the system instructions.',
        '',
        '```json',
        JSON.stringify(userPayload, null, 2),
        '```',
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

function serializeGoal(goal: RunningGoal) {
    return {
        priority: goal.priority,
        goalType: GOAL_TYPE_LABELS[goal.goalType],
        targetEventName: goal.targetEventName,
        targetEventDate: goal.targetEventDate?.toISOString().slice(0, 10) ?? null,
        targetDistanceM: goal.targetDistanceM,
        targetTimeSec: goal.targetTimeSec,
        notes: goal.notes,
    };
}

function ageFromBirthDate(birthDate: Date): number {
    const now = new Date();
    let age = now.getUTCFullYear() - birthDate.getUTCFullYear();
    const monthDiff = now.getUTCMonth() - birthDate.getUTCMonth();
    if (monthDiff < 0 || (monthDiff === 0 && now.getUTCDate() < birthDate.getUTCDate())) {
        age -= 1;
    }
    return age;
}
