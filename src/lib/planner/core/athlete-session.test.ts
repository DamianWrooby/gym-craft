import { describe, expect, it } from 'vitest';
import { readAthleteSession } from './athlete-session';
import { getSchool } from '../schools/catalogue';

const school = getSchool('POLARIZED');
const label = school.intensityLabels[0].key;

describe('readAthleteSession', () => {
    it('reads intended other training and costs it by effort', () => {
        const result = readAthleteSession(
            { kind: 'OTHER', date: '2026-10-22', modality: 'ride', durationMin: 90, effort: 'moderate' },
            { school, paceSecPerKm: null },
        );
        expect(result).toEqual({
            ok: true,
            session: {
                kind: 'OTHER',
                scheduledDate: '2026-10-22',
                sequence: 0,
                body: { bodyVersion: 1, title: 'Ride', modality: 'ride', durationMin: 90, effort: 'moderate' },
            },
            cost: { plannedLoad: 270, method: 'ATHLETE_ESTIMATE' },
        });
    });

    it('rejects other training with no effort', () => {
        const result = readAthleteSession(
            { kind: 'OTHER', date: '2026-10-22', modality: 'swim', durationMin: 30 },
            { school, paceSecPerKm: null },
        );
        expect(result.ok).toBe(false);
    });

    it('reads a running session through the same rules as the planner', () => {
        const ok = readAthleteSession(
            { kind: 'RUNNING', date: '2026-10-22', title: 'Easy', steps: [{ label, durationSec: 1800 }] },
            { school, paceSecPerKm: null },
        );
        expect(ok).toMatchObject({ ok: true, session: { kind: 'RUNNING', body: { title: 'Easy' } } });

        const unknown = readAthleteSession(
            { kind: 'RUNNING', date: '2026-10-22', title: 'Easy', steps: [{ label: 'nope', durationSec: 1800 }] },
            { school, paceSecPerKm: null },
        );
        expect(unknown.ok).toBe(false);
    });

    it('rejects a distance step that no anchor can cost', () => {
        const result = readAthleteSession(
            { kind: 'RUNNING', date: '2026-10-22', title: 'Easy', steps: [{ label, distanceM: 5000 }] },
            { school, paceSecPerKm: null },
        );
        expect(result.ok).toBe(false);
    });
});
