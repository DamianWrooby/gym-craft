// Match activities (spec #409, stories 62–63): pairs one plan week's open sessions with the
// activities synced into that week. Leftover activities are unscheduled activities.
import { isRunningTypeKey, isWalkingTypeKey } from '$lib/utils/activity-type';
import { daysBetween } from '$lib/utils/iso-week';
import { isRepeat, type OtherModality, type RunBlock, type SessionKind } from './session';

export interface MatchSession {
    id: string;
    kind: SessionKind;
    /** YYYY-MM-DD. */
    date: string;
    /** Null when the body does not say how long it runs (a step set by distance). */
    durationSec: number | null;
    plannedLoad: number;
    /** Set for `OTHER` sessions only. */
    modality: OtherModality | null;
    /** Marked done or skipped by hand: evidence may still settle it, after planned sessions. */
    marked: boolean;
}

export interface MatchActivity {
    id: string;
    kind: SessionKind;
    modality: OtherModality | null;
    /** The athlete's local YYYY-MM-DD. */
    date: string;
    /** ISO timestamp; orders ties. */
    startTime: string;
    durationSec: number;
    load: number | null;
}

export interface MatchLink {
    sessionId: string;
    activityId: string;
}

export interface MatchResult {
    links: MatchLink[];
    /** Activity IDs linked to no session, in start order. */
    unscheduled: string[];
}

/**
 * Lower is closer (ADR 0023 §4): |Δduration|/plannedDuration + |Δdensity|/plannedDensity, with
 * density as load per minute. A session with no planned duration pairs on |Δload|/plannedLoad.
 */
function fit(session: MatchSession, activity: MatchActivity): number {
    const gap = (actual: number, planned: number) => (planned > 0 ? Math.abs(actual - planned) / planned : 0);
    const load = activity.load ?? 0;
    if (session.durationSec && activity.durationSec > 0) {
        const density = gap((load * 60) / activity.durationSec, (session.plannedLoad * 60) / session.durationSec);
        return gap(activity.durationSec, session.durationSec) + density;
    }
    return gap(load, session.plannedLoad);
}

function eligible(session: MatchSession, activity: MatchActivity): boolean {
    if (session.kind !== activity.kind) return false;
    if (session.kind !== 'OTHER') return true;
    return session.date === activity.date && (session.modality ?? 'other') === (activity.modality ?? 'other');
}

const isLower = (a: number[], b: number[]) => {
    const i = a.findIndex((v, k) => v !== b[k]);
    return i >= 0 && a[i] < b[i];
};

/** Same day first (across the whole week), then the nearest day; ties go to the earlier start. */
export function matchActivities(sessions: MatchSession[], activities: MatchActivity[]): MatchResult {
    const ordered = [...activities].sort((a, b) => a.startTime.localeCompare(b.startTime));
    const open = new Set(sessions.map((s) => s.id));
    const linked = new Map<string, string>();

    const pass = (sameDayOnly: boolean) => {
        for (const activity of ordered) {
            if (linked.has(activity.id)) continue;
            let best: MatchSession | null = null;
            let bestRank: number[] = [];
            for (const session of sessions) {
                if (!open.has(session.id) || !eligible(session, activity)) continue;
                const days = Math.abs(daysBetween(session.date, activity.date));
                if (sameDayOnly && days !== 0) continue;
                const rank = [days, session.marked ? 1 : 0, fit(session, activity)];
                if (!best || isLower(rank, bestRank)) {
                    best = session;
                    bestRank = rank;
                }
            }
            if (best) {
                open.delete(best.id);
                linked.set(activity.id, best.id);
            }
        }
    };
    pass(true);
    pass(false);

    return {
        links: [...linked].map(([activityId, sessionId]) => ({ sessionId, activityId })),
        unscheduled: ordered.filter((a) => !linked.has(a.id)).map((a) => a.id),
    };
}

/** The plan kind a Garmin activity type fulfils; null for walking, which is not training. */
export function activityKindOf(typeKey: string): { kind: SessionKind; modality: OtherModality | null } | null {
    if (isRunningTypeKey(typeKey)) return { kind: 'RUNNING', modality: null };
    if (typeKey.startsWith('strength')) return { kind: 'STRENGTH', modality: null };
    if (isWalkingTypeKey(typeKey)) return null;
    if (typeKey.includes('cycling') || typeKey.includes('biking')) return { kind: 'OTHER', modality: 'ride' };
    if (typeKey.includes('swim')) return { kind: 'OTHER', modality: 'swim' };
    if (typeKey.includes('hiking')) return { kind: 'OTHER', modality: 'hike' };
    return { kind: 'OTHER', modality: 'other' };
}

function blocksSec(blocks: RunBlock[]): number | null {
    let total = 0;
    for (const block of blocks) {
        const sec = isRepeat(block) ? blocksSec(block.steps) : (block.durationSec ?? null);
        if (sec == null) return null;
        total += isRepeat(block) ? sec * block.repeat : sec;
    }
    return total;
}

/** How long a stored session body runs, or null when a step is set by distance. */
export function plannedDurationSec(kind: SessionKind, body: unknown): number | null {
    const b = body as { steps?: RunBlock[]; durationMin?: number } | null;
    if (kind === 'RUNNING') return Array.isArray(b?.steps) ? blocksSec(b.steps) : null;
    return typeof b?.durationMin === 'number' ? b.durationMin * 60 : null;
}
