import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$env/static/public', () => ({ PUBLIC_APP_ENV: 'test' }));
vi.mock('$lib/database', () => ({ db: {} }));

import { revisionAwaitsFinalize } from './adapt';
import type { ActivePlan } from './repository';

const now = new Date('2026-10-14T09:00:00Z');
const minutesAgo = (m: number) => new Date(now.getTime() - m * 60_000);

const planWith = (revisionGeneration: string | null, request: { status: string; updatedAt: Date } | null) =>
    ({
        phases: [
            {
                weeks: [
                    {
                        id: 'week-1',
                        startDate: new Date('2026-10-12T00:00:00Z'),
                        endDate: new Date('2026-10-18T00:00:00Z'),
                        revisionGeneration,
                        revisionRequest: request,
                    },
                ],
            },
        ],
    }) as unknown as ActivePlan;

beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(now);
});

afterEach(() => vi.useRealTimers());

describe('revisionAwaitsFinalize', () => {
    it('settles a DONE revision of the current week', () => {
        expect(revisionAwaitsFinalize(planWith('PENDING', { status: 'DONE', updatedAt: now }), '2026-10-14')).toBe(
            'week-1',
        );
    });

    it('settles a revision whose proxy call never started (#423)', () => {
        const plan = planWith('PENDING', { status: 'PENDING', updatedAt: minutesAgo(10) });
        expect(revisionAwaitsFinalize(plan, '2026-10-14')).toBe('week-1');
    });

    it('leaves a revision still running', () => {
        const plan = planWith('PENDING', { status: 'RUNNING', updatedAt: minutesAgo(1) });
        expect(revisionAwaitsFinalize(plan, '2026-10-14')).toBeNull();
    });

    it('looks only at the current week', () => {
        expect(
            revisionAwaitsFinalize(planWith('PENDING', { status: 'DONE', updatedAt: now }), '2026-10-20'),
        ).toBeNull();
    });
});
