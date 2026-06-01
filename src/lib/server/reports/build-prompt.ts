import type { AthleteProfile, RunningGoal } from '@prisma/client';
import type { MetricsBundle } from '$lib/server/analytics/types';
import { GOAL_TYPE_LABELS } from '@/constants/training-report.constants';
import { ageFromBirthDate } from '$lib/utils/age';

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

Your tone is supportive, specific, and grounded in the data provided. You explain what the numbers mean rather than restating them. You point out trends, deviations, and what the athlete should change next week — but you never invent numbers and you never give medical advice.

The "metrics" block (volume, intensity, efficiency, deltas) is RUNNING-ONLY. The "crossTraining" block summarizes non-running sessions in the same week (gym, cycling, swimming, etc.). The "loadProfile" block contains training-load context computed across the last 28 days (TRIMP-based acute load, chronic load, ACWR, monotony, strain). Factor all three into the review and the recommendations.

Write the review in markdown with these sections:
1. **Summary** — one or two sentences capturing the headline of the week, referencing the load status when notable.
2. **Volume & consistency** — what the running distribution across the week reveals.
3. **Intensity quality** — how the running time-in-zones (if available) reflects training balance.
4. **Efficiency & response** — what running pace, HR, and any week-over-week deltas suggest.
5. **Training load & risk** — interpret acute vs chronic load, ACWR, monotony. Be specific about whether the athlete is undertraining, in the optimal zone, overreaching, or at elevated risk. Skip this section only if loadProfile.hasSufficientHistory is false; in that case briefly note the baseline is still being built.
6. **Recommended adjustments for next week** — concrete, decision-grade guidance, in this order:
   - **Direction** (single line): push / hold / reduce, with a one-sentence rationale that cites a load metric.
   - **Actions** (bulleted list): specific targets — e.g. weekly volume adjustment as a percentage, recommended session mix (number of easy / threshold / long / interval sessions), sessions to avoid, sessions to add.
   - **Status line** (single line): \`Fatigue Risk: low | moderate | high · Readiness: low | moderate | high · Adaptation: positive | neutral | negative\`.

Rules:
- Do not invent metrics that are not present in the data. If a value is null, do not reason from it.
- If HR zone bounds are not configured, qualify zone interpretation as relative ("roughly half at low intensity") rather than absolute.
- Phrase risk in terms of training load and recovery, never medical diagnosis. Do not tell the athlete they are injured or to stop training entirely.
- Recommendations must be specific and actionable ("reduce weekly volume by ~15%, replace one tempo with an easy run"), never generic ("train smart").
- Reference the athlete's goals when shaping recommendations.
- Keep the review under 500 words.
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
        loadProfile: metrics.loadProfile ?? null,
        crossTraining: metrics.crossTraining ?? null,
    };

    const user = [
        "Here is this week's training data. Generate the weekly review per the system instructions.",
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
