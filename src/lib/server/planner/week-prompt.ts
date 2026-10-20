// The prompt for one plan week's sessions (ADR 0014). Built entirely on the server and written to
// the AiRequest row; the browser only ever holds the row's id.
import { addDays, daysBetween } from '$lib/utils/iso-week';
import { WEEKDAYS, type AvailabilityMap } from '$lib/planner/wizard';
import type { SchoolDefinition, VolumeUnit } from '$lib/planner/schools/types';
import { LONG_RUN_KEY } from '$lib/planner/core/placement';
import { formatVolume } from '$lib/planner/plan-view';
import { labelPaces } from '$lib/planner/core/targets';
import type { Anchor } from '$lib/planner/core/anchor';
import type { WeekOutlook } from '$lib/planner/core/pull';

export interface AiRequestInput {
    system: string;
    user: string;
    maxTokens: number;
    /** Ask the model for a JSON object. */
    json: boolean;
    /**
     * The anchor the prompt was built with. The proxy ignores it; finalize reads it back so costing
     * and pace targets match what the model was told, even if a newer result arrives meanwhile.
     */
    anchor: Anchor | null;
}

export interface WeekPromptInput {
    school: SchoolDefinition;
    phase: { name: string; intent: string; source: 'SCHOOL' | 'LEAD_IN' };
    week: {
        startDate: string;
        /** First and last day inside the horizon. */
        from: string;
        to: string;
        isCutback: boolean;
        isTaper: boolean;
        volumeTarget: number;
        volumeUnit: VolumeUnit;
        strengthSessionTarget: number;
        timeTrialDistanceM: number | null;
    };
    availability: AvailabilityMap;
    longRunDay: number;
    anchor: Anchor | null;
    /** Set at a pull; week 1 has none. */
    outlook?: WeekOutlook;
}

const OUTLOOK_LINES: Record<Exclude<WeekOutlook, 'NORMAL'>, string> = {
    BUSY: 'Week outlook: busy. Keep sessions short and drop easy volume before key sessions.',
    TRAVEL: 'Week outlook: travel. Prefer runs that need no track or gym; keep strength to bodyweight.',
    ILL: 'Week outlook: ill. Favour easy running and light strength.',
};

/** Reasoning models spend output tokens on thinking; a week needs ~5k (ADR 0016 estimate). */
const MAX_TOKENS = 8000;

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const SYSTEM = `You are a running and strength coach writing one week of a training plan.
Follow the training school you are given exactly. Use only its intensity labels, key sessions and strength templates.
Answer with one JSON object and nothing else, in this shape:
{"sessions":[
 {"kind":"RUNNING","date":"YYYY-MM-DD","title":"...","keySession":"<key or null>","cutKey":"<cut-order key or null>",
  "steps":[{"label":"<label key>","durationSec":600,"note":"..."},{"repeat":5,"steps":[{"label":"<label key>","distanceM":1000},{"label":"<label key>","durationSec":120}]}]},
 {"kind":"STRENGTH","date":"YYYY-MM-DD","title":"...","template":"<template key>","durationMin":45,
  "exercises":[{"name":"Back squat","sets":4,"reps":"6","load":"RPE 7"}]}
]}
Rules that reject the whole week when broken:
- Every running step has a label from the list and either durationSec or distanceM.
- Repeats are one level deep.
- Only RUNNING and STRENGTH sessions.
- Sessions only on the training days listed, inside the dates given.
- The long run (keySession "${LONG_RUN_KEY}") falls on the long-run day.
- No two key sessions on consecutive days.
- No heavy strength template on the day before a key run.
- No strength session on the long-run day.
- In a full week, at least one day has no session.`;

function list(lines: string[]): string {
    return lines.map((l) => `- ${l}`).join('\n');
}

export function buildWeekPrompt(input: WeekPromptInput): AiRequestInput {
    const { school, phase, week } = input;
    const days: string[] = [];
    for (let i = 0; i <= daysBetween(week.from, week.to); i++) {
        const date = addDays(week.from, i);
        const weekday = daysBetween(week.startDate, date);
        if (!input.availability[WEEKDAYS[weekday]]) continue;
        days.push(`${date} (${DAY_NAMES[weekday]})${weekday === input.longRunDay ? ' — long-run day' : ''}`);
    }

    const weekKind = [week.isCutback && 'cutback week', week.isTaper && 'taper week'].filter(Boolean).join(', ');
    const sections = [
        `Training school: ${school.name}. ${school.tagline}`,
        `Phase: ${phase.name}${phase.source === 'LEAD_IN' ? ` (GymCraft lead-in, shaped to fit ${school.name}: ${school.leadIn.split.value}; neuromuscular touch: ${school.leadIn.touch.value})` : ''}. Intent: ${phase.intent}`,
        `Week: ${week.from} to ${week.to}${weekKind ? ` (${weekKind})` : ''}.`,
        `Running volume target: ${formatVolume(week.volumeTarget, week.volumeUnit)}.`,
        `Strength sessions: exactly ${week.strengthSessionTarget}.`,
        input.outlook && input.outlook !== 'NORMAL' ? OUTLOOK_LINES[input.outlook] : '',
        week.timeTrialDistanceM
            ? `Schedule a ${week.timeTrialDistanceM / 1000} km time trial as one running session, all-out after a warm-up.`
            : '',
        `Training days:\n${list(days)}`,
        `Intensity labels (use the key):\n${list(school.intensityLabels.map((l) => `${l.key}: ${l.name}`))}`,
        `Key sessions (keySession):\n${list(school.keySessions.map((k) => `${k.key}: ${k.name}`))}`,
        `Other runs (cutKey), cheapest to lose first: ${school.cutOrder.value.join(', ')}.`,
        `Strength templates:\n${list(school.strengthTemplates.map((t) => `${t.key}: ${t.name} (${t.tag})`))}`,
        labelPaces(school, input.anchor) != null
            ? 'Steps may use durationSec or distanceM.'
            : 'No pace anchor exists: every running step must use durationSec, never distanceM.',
    ];

    return {
        system: SYSTEM,
        user: sections.filter(Boolean).join('\n\n'),
        maxTokens: MAX_TOKENS,
        json: true,
        anchor: input.anchor,
    };
}
