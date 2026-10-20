import { describe, expect, it } from 'vitest';
import { OUTLOOK_FACTORS, pullTarget, unconfirmedSessions } from './pull';

const weeks = [
    { id: 'w1', startDate: '2026-10-12', endDate: '2026-10-18', hasRequest: true },
    { id: 'w2', startDate: '2026-10-19', endDate: '2026-10-25', hasRequest: false },
    { id: 'w3', startDate: '2026-10-26', endDate: '2026-11-01', hasRequest: false },
];

describe('pullTarget', () => {
    it('writes next week when the current week is written', () => {
        expect(pullTarget(weeks, '2026-10-14')?.id).toBe('w2');
    });

    it('writes the current week first when the athlete was away for it', () => {
        expect(pullTarget(weeks, '2026-10-20')?.id).toBe('w2');
        expect(
            pullTarget(
                weeks.map((w) => ({ ...w, hasRequest: false })),
                '2026-10-27',
            )?.id,
        ).toBe('w3');
    });

    it('writes nothing once next week has its request', () => {
        expect(pullTarget([{ ...weeks[0] }, { ...weeks[1], hasRequest: true }, weeks[2]], '2026-10-14')).toBeNull();
    });

    it('writes nothing outside the horizon or in the last week', () => {
        expect(pullTarget(weeks, '2026-10-11')).toBeNull();
        expect(pullTarget(weeks, '2026-11-02')).toBeNull();
        expect(pullTarget([{ ...weeks[2], hasRequest: true }], '2026-10-27')).toBeNull();
    });
});

describe('unconfirmedSessions', () => {
    it('lists planned sessions dated before today', () => {
        const sessions = [
            { id: 'a', status: 'PLANNED', scheduledDate: '2026-10-13' },
            { id: 'b', status: 'DONE', scheduledDate: '2026-10-13' },
            { id: 'c', status: 'PLANNED', scheduledDate: '2026-10-20' },
            { id: 'd', status: 'SKIPPED', scheduledDate: '2026-10-14' },
        ];
        expect(unconfirmedSessions(sessions, '2026-10-20').map((s) => s.id)).toEqual(['a']);
    });
});

describe('OUTLOOK_FACTORS', () => {
    it('holds the judged values of ADR 0024', () => {
        expect(OUTLOOK_FACTORS).toEqual({ NORMAL: 1, BUSY: 0.85, TRAVEL: 0.85, ILL: 0.6 });
    });
});
