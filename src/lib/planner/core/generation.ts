// Validate generation (ADRs 0007, 0009, 0026): the model's raw output becomes typed sessions, or is
// rejected whole. Nothing uncostable and nothing that breaks a placement rule is ever stored.
import type { SchoolDefinition } from '../schools/types';
import { costSession } from './cost';
import { placementViolations, type PlacementContext } from './placement';
import { BODY_VERSION, type Exercise, type RunBlock, type RunStep, type TypedSession } from './session';

export interface GenerationContext {
    school: SchoolDefinition;
    /** Pace per intensity label from the anchor; null when no anchor exists. */
    paceSecPerKm: Record<string, number> | null;
    placement: PlacementContext;
}

export type GenerationResult = { ok: true; sessions: TypedSession[] } | { ok: false; errors: string[] };

type Raw = Record<string, unknown>;

const isObject = (v: unknown): v is Raw => typeof v === 'object' && v != null && !Array.isArray(v);
const isPositive = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0;
const text = (v: unknown, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const DATE = /^\d{4}-\d{2}-\d{2}$/;

function parse(raw: string): unknown {
    // Models sometimes wrap JSON in a code fence.
    const stripped = raw
        .trim()
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/```$/, '');
    try {
        return JSON.parse(stripped);
    } catch {
        return null;
    }
}

function readStep(raw: unknown, school: SchoolDefinition, errors: string[], where: string): RunStep | null {
    if (!isObject(raw)) return (errors.push(`${where}: a step must be an object`), null);
    const label = text(raw.label, 40);
    if (!label) return (errors.push(`${where}: a step has no intensity label`), null);
    if (!school.intensityLabels.some((l) => l.key === label)) {
        return (errors.push(`${where}: unknown intensity label "${label}"`), null);
    }
    const step: RunStep = { label };
    if (isPositive(raw.durationSec)) step.durationSec = Math.round(raw.durationSec);
    else if (isPositive(raw.distanceM)) step.distanceM = Math.round(raw.distanceM);
    else return (errors.push(`${where}: a step has no duration or distance`), null);
    const note = text(raw.note);
    if (note) step.note = note;
    return step;
}

function readBlocks(raw: unknown, school: SchoolDefinition, errors: string[], where: string, nested = false) {
    if (!Array.isArray(raw) || raw.length === 0) return (errors.push(`${where}: no steps`), []);
    const blocks: RunBlock[] = [];
    for (const item of raw) {
        if (isObject(item) && 'repeat' in item && !nested) {
            if (!Number.isInteger(item.repeat) || (item.repeat as number) < 1) {
                errors.push(`${where}: a repeat needs a whole number of times`);
                continue;
            }
            const steps = readBlocks(item.steps, school, errors, where, true) as RunStep[];
            blocks.push({ repeat: item.repeat as number, steps });
        } else {
            const step = readStep(item, school, errors, where);
            if (step) blocks.push(step);
        }
    }
    return blocks;
}

function readExercises(raw: unknown, errors: string[], where: string): Exercise[] {
    if (!Array.isArray(raw) || raw.length === 0) return (errors.push(`${where}: no exercises`), []);
    return raw.flatMap((e) => {
        if (!isObject(e) || !text(e.name) || !Number.isInteger(e.sets) || (e.sets as number) < 1) {
            errors.push(`${where}: an exercise needs a name and sets`);
            return [];
        }
        return [
            {
                name: text(e.name),
                sets: e.sets as number,
                reps: text(String(e.reps ?? ''), 40),
                load: text(e.load, 80),
            },
        ];
    });
}

function readSession(raw: unknown, ctx: GenerationContext, errors: string[], index: number) {
    const where = `Session ${index + 1}`;
    if (!isObject(raw)) return (errors.push(`${where}: must be an object`), null);
    const date = text(raw.date, 10);
    if (!DATE.test(date)) return (errors.push(`${where}: date must be YYYY-MM-DD`), null);
    const title = text(raw.title, 120) || 'Session';
    const { school } = ctx;

    if (raw.kind === 'RUNNING') {
        const keySession = raw.keySession == null ? null : text(raw.keySession, 40);
        const key = keySession ? school.keySessions.find((k) => k.key === keySession) : null;
        if (keySession && !key) return (errors.push(`${where}: unknown key session "${keySession}"`), null);
        const before = errors.length;
        const steps = readBlocks(raw.steps, school, errors, where);
        if (errors.length > before) return null;
        const cutKey = raw.cutKey == null ? null : text(raw.cutKey, 40) || null;
        return {
            kind: 'RUNNING' as const,
            date,
            body: { bodyVersion: BODY_VERSION, title, keySession, reason: key?.reason ?? null, cutKey, steps },
        };
    }

    if (raw.kind === 'STRENGTH') {
        const template = school.strengthTemplates.find((t) => t.key === raw.template);
        if (!template) errors.push(`${where}: unknown strength template "${text(raw.template, 40)}"`);
        if (!isPositive(raw.durationMin)) errors.push(`${where}: a strength session needs a duration`);
        const exercises = readExercises(raw.exercises, errors, where);
        if (!template || !isPositive(raw.durationMin)) return null;
        return {
            kind: 'STRENGTH' as const,
            date,
            body: {
                bodyVersion: BODY_VERSION,
                title,
                template: template.key,
                heavy: template.tag === 'heavy',
                durationMin: Math.round(raw.durationMin),
                exercises,
            },
        };
    }

    if (raw.kind === 'OTHER') return (errors.push(`${where}: the planner never writes an OTHER session`), null);
    return (errors.push(`${where}: unknown session kind`), null);
}

export function validateGeneration(rawOutput: string, ctx: GenerationContext): GenerationResult {
    const parsed = parse(rawOutput);
    if (!isObject(parsed) || !Array.isArray(parsed.sessions)) {
        return { ok: false, errors: ['The output is not a JSON object with a sessions list'] };
    }

    const errors: string[] = [];
    const read = parsed.sessions.map((s, i) => readSession(s, ctx, errors, i));
    if (errors.length > 0) return { ok: false, errors };

    const perDay = new Map<string, number>();
    const sessions = read
        .filter((s) => s != null)
        .map((s) => {
            const sequence = perDay.get(s.date) ?? 0;
            perDay.set(s.date, sequence + 1);
            return { kind: s.kind, scheduledDate: s.date, sequence, body: s.body } as TypedSession;
        });

    for (const s of sessions) {
        try {
            costSession(s, ctx);
        } catch {
            errors.push(`${s.scheduledDate} ${s.body.title}: a distance step has no pace to cost it from`);
        }
    }
    if (errors.length > 0) return { ok: false, errors };

    const violations = placementViolations(sessions, ctx.placement);
    if (violations.length > 0) return { ok: false, errors: violations };
    return { ok: true, sessions };
}
