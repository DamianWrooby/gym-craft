// Add and edit (spec #409, stories 33–35): one reader for a session the athlete writes, whatever its
// kind. Running and strength pass the planner's own rules; every session is costed before it is kept.
import { costSession, type Cost, type CostContext } from './cost';
import { readSession } from './generation';
import {
    BODY_VERSION,
    OTHER_EFFORTS,
    OTHER_MODALITIES,
    type OtherEffort,
    type OtherModality,
    type TypedSession,
} from './session';

export type AthleteSessionResult = { ok: true; session: TypedSession; cost: Cost } | { ok: false; errors: string[] };

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const MODALITY_TITLES: Record<OtherModality, string> = { ride: 'Ride', swim: 'Swim', hike: 'Hike', other: 'Other' };

function readOther(raw: Record<string, unknown>, errors: string[]): TypedSession | null {
    const date = typeof raw.date === 'string' ? raw.date : '';
    if (!DATE.test(date)) errors.push('date must be YYYY-MM-DD');
    const modality = raw.modality as OtherModality;
    if (!OTHER_MODALITIES.includes(modality)) errors.push('modality must be ride, swim, hike or other');
    const effort = raw.effort as OtherEffort;
    if (!OTHER_EFFORTS.includes(effort)) errors.push('effort must be easy, moderate or hard');
    const durationMin = raw.durationMin;
    if (typeof durationMin !== 'number' || !Number.isFinite(durationMin) || durationMin <= 0 || durationMin > 1440) {
        errors.push('duration must be between 1 and 1440 minutes');
    }
    if (errors.length > 0) return null;
    const title = typeof raw.title === 'string' && raw.title.trim() ? raw.title.trim().slice(0, 120) : null;
    return {
        kind: 'OTHER',
        scheduledDate: date,
        sequence: 0,
        body: {
            bodyVersion: BODY_VERSION,
            title: title ?? MODALITY_TITLES[modality],
            modality,
            durationMin: Math.round(durationMin as number),
            effort,
        },
    };
}

export function readAthleteSession(raw: unknown, ctx: CostContext): AthleteSessionResult {
    if (typeof raw !== 'object' || raw == null) return { ok: false, errors: ['session must be an object'] };
    const errors: string[] = [];
    let session: TypedSession | null;
    if ((raw as Record<string, unknown>).kind === 'OTHER') {
        session = readOther(raw as Record<string, unknown>, errors);
    } else {
        const read = readSession(raw, ctx, errors, 0);
        session = read
            ? ({ kind: read.kind, scheduledDate: read.date, sequence: 0, body: read.body } as TypedSession)
            : null;
    }
    if (!session || errors.length > 0) return { ok: false, errors };
    try {
        return { ok: true, session, cost: costSession(session, ctx) };
    } catch {
        return { ok: false, errors: ['a distance step has no pace to cost it from'] };
    }
}
