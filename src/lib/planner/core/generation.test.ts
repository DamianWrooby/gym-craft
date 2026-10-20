import { describe, expect, it } from 'vitest';
import { validateGeneration, type GenerationContext } from './generation';
import { getSchool } from '../schools/catalogue';

const ctx: GenerationContext = {
    school: getSchool('DANIELS'),
    paceSecPerKm: null,
    placement: {
        weekStart: '2026-10-19',
        from: '2026-10-19',
        to: '2026-10-25',
        availability: { mon: true, tue: true, wed: true, thu: true, fri: true, sat: true, sun: true },
        longRunDay: 6,
        keySessions: ['q1', 'q2', 'long'],
    },
};

const q1 = {
    kind: 'RUNNING',
    date: '2026-10-20',
    title: 'Threshold',
    keySession: 'q1',
    steps: [
        { label: 'E', durationSec: 900 },
        {
            repeat: 4,
            steps: [
                { label: 'T', durationSec: 300 },
                { label: 'E', durationSec: 60 },
            ],
        },
    ],
};
const lift = {
    kind: 'STRENGTH',
    date: '2026-10-22',
    title: 'Light lift',
    template: 'light-maintenance',
    durationMin: 40,
    exercises: [{ name: 'Split squat', sets: 3, reps: '8', load: 'RPE 7' }],
};
const long = {
    kind: 'RUNNING',
    date: '2026-10-25',
    title: 'Long run',
    keySession: 'long',
    steps: [{ label: 'E', durationSec: 5400 }],
};

const output = (sessions: unknown[]) => JSON.stringify({ sessions });

describe('validateGeneration', () => {
    it('turns a valid week into typed sessions with the school reason and template tag', () => {
        const result = validateGeneration(output([q1, lift, long]), ctx);
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.sessions).toHaveLength(3);
        expect(result.sessions[0]).toMatchObject({
            kind: 'RUNNING',
            scheduledDate: '2026-10-20',
            body: { keySession: 'q1', reason: expect.stringMatching(/quality day/i) },
        });
        expect(result.sessions[1]).toMatchObject({ kind: 'STRENGTH', body: { heavy: false, durationMin: 40 } });
    });

    it('orders two sessions on one day by sequence', () => {
        const result = validateGeneration(output([q1, { ...lift, date: '2026-10-20' }, long]), ctx);
        expect(
            result.ok && result.sessions.filter((s) => s.scheduledDate === '2026-10-20').map((s) => s.sequence),
        ).toEqual([0, 1]);
    });

    it('rejects output that is not JSON', () => {
        expect(validateGeneration('Here is your week!', ctx)).toMatchObject({ ok: false });
    });

    it('rejects an unknown intensity label', () => {
        const bad = { ...long, steps: [{ label: 'Tempo', durationSec: 1800 }] };
        expect(validateGeneration(output([bad]), ctx)).toEqual({
            ok: false,
            errors: [expect.stringMatching(/unknown intensity label "Tempo"/i)],
        });
    });

    it('rejects a step with no duration or distance', () => {
        const bad = { ...long, steps: [{ label: 'E' }] };
        expect(validateGeneration(output([bad]), ctx)).toEqual({
            ok: false,
            errors: [expect.stringMatching(/duration/i)],
        });
    });

    it('rejects a step with no intensity label', () => {
        const bad = { ...long, steps: [{ durationSec: 600 }] };
        expect(validateGeneration(output([bad]), ctx)).toEqual({
            ok: false,
            errors: [expect.stringMatching(/label/i)],
        });
    });

    it('rejects a distance step it cannot cost without an anchor', () => {
        const bad = { ...long, steps: [{ label: 'E', distanceM: 16000 }] };
        expect(validateGeneration(output([bad]), ctx)).toEqual({ ok: false, errors: [expect.stringMatching(/pace/i)] });
    });

    it('accepts a distance step when the anchor gives a pace', () => {
        const withPace = { ...ctx, paceSecPerKm: { E: 330 } };
        expect(validateGeneration(output([{ ...long, steps: [{ label: 'E', distanceM: 16000 }] }]), withPace).ok).toBe(
            true,
        );
    });

    it('rejects an OTHER session: the planner never writes one', () => {
        const other = { kind: 'OTHER', date: '2026-10-21', title: 'Ride', durationMin: 60, effort: 'easy' };
        expect(validateGeneration(output([other, long]), ctx)).toEqual({
            ok: false,
            errors: [expect.stringMatching(/OTHER/)],
        });
    });

    it('rejects a strength session with no duration or an unknown template', () => {
        const result = validateGeneration(output([{ ...lift, durationMin: 0, template: 'crossfit' }, long]), ctx);
        expect(result).toEqual({
            ok: false,
            errors: [expect.stringMatching(/template/i), expect.stringMatching(/duration/i)],
        });
    });

    it('rejects a week that breaks a placement rule', () => {
        const result = validateGeneration(output([q1, { ...long, date: '2026-10-21' }]), ctx);
        expect(result).toEqual({
            ok: false,
            errors: [expect.stringMatching(/long run/i), expect.stringMatching(/consecutive/i)],
        });
    });
});
