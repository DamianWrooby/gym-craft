// Explain plan: how the athlete's data shaped the laid-out horizon. Pure; built once at creation
// and stored with the plan, because the inputs (recent running, anchor) change afterwards.
import { formatVolume } from '../plan-view';
import { getSchool, isSchoolId } from '../schools/catalogue';
import { CUTBACK_CAP } from '../schools/gymcraft-rules';
import type { SchoolDefinition } from '../schools/types';
import type { Anchor } from './anchor';
import type { Layout, RecentVolume } from './layout';

export interface ExplainInput {
    school: SchoolDefinition;
    layout: Layout;
    /** `date` is null for an undated goal. */
    goal: { name: string; date: string | null };
    recommended: { schoolId: string; reason: string } | null;
    anchor: Anchor | null;
    recentVolume: RecentVolume;
    runsPerWeek: number;
    /** 0 = Monday … 6 = Sunday. */
    longRunDay: number;
}

export interface RationaleSection {
    key: 'school' | 'horizon' | 'anchor' | 'volume' | 'recovery' | 'week';
    title: string;
    lines: string[];
}

export interface PlanRationale {
    sections: RationaleSection[];
}

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const NAMED_DISTANCES: Record<number, string> = {
    1500: '1500 m',
    5000: '5 km',
    10000: '10 km',
    21097: 'half marathon',
    42195: 'marathon',
};

export function distanceName(metres: number): string {
    return NAMED_DISTANCES[metres] ?? `${(metres / 1000).toFixed(1)} km`;
}

export function formatDuration(sec: number): string {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = String(sec % 60).padStart(2, '0');
    return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

function listWeeks(numbers: number[]): string {
    if (numbers.length <= 1) return numbers.join('');
    return `${numbers.slice(0, -1).join(', ')} and ${numbers[numbers.length - 1]}`;
}

function schoolSection({ school, recommended }: ExplainInput): RationaleSection {
    const lines: string[] = [];
    if (recommended?.schoolId === school.id) {
        lines.push(`You chose ${school.name}, the school GymCraft recommended: ${recommended.reason}`);
    } else if (recommended) {
        const name = isSchoolId(recommended.schoolId) ? getSchool(recommended.schoolId).name : recommended.schoolId;
        lines.push(`GymCraft recommended ${name} (${recommended.reason}). You chose ${school.name}.`);
    } else {
        lines.push(`You chose ${school.name}.`);
    }
    lines.push(school.tagline);
    return { key: 'school', title: 'Training school', lines };
}

function horizonSection({ school, layout, goal }: ExplainInput): RationaleSection {
    const n = layout.weeks.length;
    const start = layout.phases[0].startDate;
    const end = layout.phases[layout.phases.length - 1].endDate;
    const lines = [
        goal.date
            ? `${plural(n, 'week')}, from ${start} to race day (${goal.name}) on ${goal.date}.`
            : `${plural(n, 'week')}, from ${start} to ${end}, the end you chose for ${goal.name}.`,
    ];
    const leadIn = layout.phases.find((p) => p.source === 'LEAD_IN');
    if (leadIn) {
        lines.push(
            `Your horizon is ${plural(leadIn.weekCount, 'week')} longer than ${school.name} needs, so it starts with a ` +
                `${leadIn.weekCount}-week GymCraft lead-in of easy running before the school's phases.`,
        );
    }
    for (const p of layout.phases) lines.push(`${p.name}: ${plural(p.weekCount, 'week')}.`);
    lines.push(...layout.losses);
    return { key: 'horizon', title: 'Horizon and phases', lines };
}

function anchorSection({ anchor, layout }: ExplainInput): RationaleSection {
    const lines: string[] = [];
    if (anchor?.provenance === 'RACE_RESULT') {
        lines.push(
            `Your paces come from your ${distanceName(anchor.distanceM)} on ${anchor.date} in ${formatDuration(anchor.timeSec)}.`,
        );
    } else if (anchor) {
        lines.push(
            `Your paces come from your best recent Garmin run: ${distanceName(anchor.distanceM)} on ${anchor.date} ` +
                `in ${formatDuration(anchor.timeSec)}. A race result gives more exact paces.`,
        );
    }
    if (anchor?.stale) lines.push('This result is more than a year old. Enter a newer one.');
    if (layout.timeTrial) {
        lines.push(
            `No race result or recent hard run, so week ${layout.timeTrial.weekIndex + 1} has a ` +
                `${distanceName(layout.timeTrial.distanceM)} time trial. Its result sets your paces.`,
        );
    }
    return { key: 'anchor', title: 'Paces', lines };
}

function volumeSection({ layout, recentVolume }: ExplainInput): RationaleSection {
    const lines: string[] = [];
    if (recentVolume.minutesPerWeek > 0) {
        lines.push(
            `In the last 4 weeks you ran ${formatVolume(recentVolume.minutesPerWeek, 'MINUTES')} a week on average ` +
                `(${(recentVolume.metresPerWeek / 1000).toFixed(1)} km).`,
        );
    } else {
        lines.push('No running in the last 4 weeks, so week 1 starts low.');
    }
    const first = layout.weeks[0];
    const peak = layout.weeks.reduce((a, b) =>
        b.volumeUnit === a.volumeUnit && b.volumeTarget > a.volumeTarget ? b : a,
    );
    lines.push(
        `Week 1 asks for ${formatVolume(first.volumeTarget, first.volumeUnit)}; the most is ` +
            `${formatVolume(peak.volumeTarget, peak.volumeUnit)} in week ${peak.index + 1}.`,
    );
    return { key: 'volume', title: 'Volume', lines };
}

function recoverySection({ school, layout }: ExplainInput): RationaleSection {
    const lines: string[] = [];
    const cutbacks = layout.weeks.filter((w) => w.isCutback).map((w) => w.index + 1);
    const tapers = layout.weeks.filter((w) => w.isTaper).map((w) => w.index + 1);
    const limit = school.cutbackCadence.value ?? CUTBACK_CAP.value;
    if (cutbacks.length > 0) {
        lines.push(
            `Easy weeks with less volume: weeks ${cutbacks.join(', ')}. One comes after at most ${limit} harder weeks.`,
        );
    }
    if (tapers.length > 0) {
        lines.push(
            `Taper: ${tapers.length === 1 ? 'week' : 'weeks'} ${listWeeks(tapers)}, so you start the race fresh.`,
        );
    }
    return { key: 'recovery', title: 'Easy weeks and taper', lines };
}

function weekSection({ runsPerWeek, longRunDay }: ExplainInput): RationaleSection {
    return {
        key: 'week',
        title: 'Your week',
        lines: [`${plural(runsPerWeek, 'run day')} a week, with the long run on ${DAY_NAMES[longRunDay]}.`],
    };
}

export function explainPlan(input: ExplainInput): PlanRationale {
    return {
        sections: [
            schoolSection(input),
            horizonSection(input),
            anchorSection(input),
            volumeSection(input),
            recoverySection(input),
            weekSection(input),
        ].filter((s) => s.lines.length > 0),
    };
}
