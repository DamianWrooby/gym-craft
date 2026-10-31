// Explain plan: how the athlete's data shaped the laid-out horizon. Pure; built once at creation
// and stored with the plan, because the inputs (recent running, anchor) change afterwards.
import { m } from '$lib/paraglide/messages.js';
import { getLocale } from '$lib/paraglide/runtime.js';
import { countRunDays, countWeeks } from '$lib/i18n/count';
import { displayPhase, displaySchool } from '$lib/i18n/school-text';
import { formatVolume } from '../plan-view';
import { distanceName, formatDuration } from '$lib/utils/race';
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

// 2024-01-01 was a Monday: the locale's full weekday name for day 0–6 of a plan week.
const dayName = (day: number) =>
    new Date(Date.UTC(2024, 0, day + 1)).toLocaleDateString(getLocale(), { weekday: 'long', timeZone: 'UTC' });

function listWeeks(numbers: number[]): string {
    if (numbers.length <= 1) return numbers.join('');
    return m.explain_list({ items: numbers.slice(0, -1).join(', '), last: numbers[numbers.length - 1] });
}

function schoolSection({ school: stored, recommended }: ExplainInput): RationaleSection {
    const school = displaySchool(stored);
    const lines: string[] = [];
    if (recommended?.schoolId === school.id) {
        lines.push(m.explain_school_recommended({ school: school.name, reason: recommended.reason }));
    } else if (recommended) {
        const name = isSchoolId(recommended.schoolId)
            ? displaySchool(getSchool(recommended.schoolId)).name
            : recommended.schoolId;
        lines.push(m.explain_school_other({ recommended: name, reason: recommended.reason, school: school.name }));
    } else {
        lines.push(m.explain_school_chosen({ school: school.name }));
    }
    lines.push(school.tagline);
    return { key: 'school', title: m.plan_training_school(), lines };
}

function horizonSection({ school, layout, goal }: ExplainInput): RationaleSection {
    const n = layout.weeks.length;
    const start = layout.phases[0].startDate;
    const end = layout.phases[layout.phases.length - 1].endDate;
    const lines: string[] = [
        goal.date
            ? m.explain_horizon_race({ weeks: countWeeks(n), start, goal: goal.name, date: goal.date })
            : m.explain_horizon_open({ weeks: countWeeks(n), start, end, goal: goal.name }),
    ];
    const leadIn = layout.phases.find((p) => p.source === 'LEAD_IN');
    if (leadIn) {
        lines.push(
            m.explain_lead_in({
                weeks: countWeeks(leadIn.weekCount),
                school: displaySchool(school).name,
                n: leadIn.weekCount,
            }),
        );
    }
    for (const p of layout.phases) {
        lines.push(`${displayPhase(school.id, p.name, p.intent).name}: ${countWeeks(p.weekCount)}.`);
    }
    lines.push(...layout.losses);
    return { key: 'horizon', title: m.explain_title_horizon(), lines };
}

function anchorSection({ anchor, layout }: ExplainInput): RationaleSection {
    const lines: string[] = [];
    if (anchor?.provenance === 'RACE_RESULT') {
        lines.push(
            m.explain_anchor_race({
                distance: distanceName(anchor.distanceM),
                date: anchor.date,
                time: formatDuration(anchor.timeSec),
            }),
        );
    } else if (anchor) {
        lines.push(
            m.explain_anchor_inferred({
                distance: distanceName(anchor.distanceM),
                date: anchor.date,
                time: formatDuration(anchor.timeSec),
            }),
        );
    }
    if (anchor?.stale) lines.push(m.explain_anchor_stale());
    if (layout.timeTrial) {
        lines.push(
            m.explain_time_trial({
                week: layout.timeTrial.weekIndex + 1,
                distance: distanceName(layout.timeTrial.distanceM),
            }),
        );
    }
    return { key: 'anchor', title: m.explain_title_paces(), lines };
}

function volumeSection({ layout, recentVolume }: ExplainInput): RationaleSection {
    const lines: string[] = [];
    if (recentVolume.minutesPerWeek > 0) {
        lines.push(
            m.explain_recent_volume({
                volume: formatVolume(recentVolume.minutesPerWeek, 'MINUTES'),
                km: (recentVolume.metresPerWeek / 1000).toFixed(1),
            }),
        );
    } else {
        lines.push(m.explain_no_recent_running());
    }
    const first = layout.weeks[0];
    const peak = layout.weeks.reduce((a, b) =>
        b.volumeUnit === a.volumeUnit && b.volumeTarget > a.volumeTarget ? b : a,
    );
    lines.push(
        m.explain_volume_range({
            first: formatVolume(first.volumeTarget, first.volumeUnit),
            peak: formatVolume(peak.volumeTarget, peak.volumeUnit),
            week: peak.index + 1,
        }),
    );
    return { key: 'volume', title: m.explain_title_volume(), lines };
}

function recoverySection({ school, layout }: ExplainInput): RationaleSection {
    const lines: string[] = [];
    const cutbacks = layout.weeks.filter((w) => w.isCutback).map((w) => w.index + 1);
    const tapers = layout.weeks.filter((w) => w.isTaper).map((w) => w.index + 1);
    const limit = school.cutbackCadence.value ?? CUTBACK_CAP.value;
    if (cutbacks.length > 0) {
        lines.push(m.explain_cutbacks({ weeks: cutbacks.join(', '), limit }));
    }
    if (tapers.length > 0) {
        lines.push(
            tapers.length === 1
                ? m.explain_taper_one({ week: tapers[0] })
                : m.explain_taper_many({ weeks: listWeeks(tapers) }),
        );
    }
    return { key: 'recovery', title: m.explain_title_recovery(), lines };
}

function weekSection({ runsPerWeek, longRunDay }: ExplainInput): RationaleSection {
    return {
        key: 'week',
        title: m.explain_title_week(),
        lines: [m.explain_week({ runDays: countRunDays(runsPerWeek), day: dayName(longRunDay) })],
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
