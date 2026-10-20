import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$env/static/public', () => ({ PUBLIC_APP_ENV: 'test' }));

const prismaMocks = vi.hoisted(() => ({ getAthleteProfile: vi.fn() }));
vi.mock('$lib/prisma/prisma', () => prismaMocks);

const tx = vi.hoisted(() => ({
    planWeek: { updateMany: vi.fn() },
    plannedSession: { deleteMany: vi.fn(), update: vi.fn() },
}));
const db = vi.hoisted(() => ({ $transaction: vi.fn(), planWeek: { findUnique: vi.fn() } }));
vi.mock('$lib/database', () => ({ db }));

import { POST } from './+server';
import { zonesFromMaxHr } from '$lib/planner/core/zones';

const userId = 'user-1';
const locals = { user: { id: userId, subscriptionTier: 'FREE' } } as unknown as App.Locals;
const d = (iso: string) => new Date(`${iso}T00:00:00Z`);

const hard = {
    id: 'hard-1',
    kind: 'RUNNING',
    origin: 'AI',
    status: 'PLANNED',
    scheduledDate: d('2026-10-14'),
    sequence: 0,
    body: {
        bodyVersion: 1,
        title: 'Hard',
        keySession: 'hard',
        reason: null,
        cutKey: null,
        steps: [
            { label: 'z1', durationSec: 900 },
            {
                repeat: 4,
                steps: [
                    { label: 'z3', durationSec: 240 },
                    { label: 'z1', durationSec: 120 },
                ],
            },
        ],
    },
};
const foundation = {
    id: 'easy-1',
    kind: 'RUNNING',
    origin: 'AI',
    status: 'PLANNED',
    scheduledDate: d('2026-10-16'),
    sequence: 0,
    body: { bodyVersion: 1, title: 'Foundation', keySession: null, reason: null, cutKey: 'foundation', steps: [] },
};

function week(overrides: Record<string, unknown> = {}) {
    return {
        id: 'week-1',
        userId,
        decision: 'PENDING',
        conflict: {
            placement: null,
            budget: {
                kind: 'ASK',
                schoolFit: false,
                removed: [{ scheduledDate: '2026-10-16', sequence: 0 }],
                keySession: { scheduledDate: '2026-10-14', sequence: 0 },
                facts: { offered: { title: 'Hard', plannedLoad: 118, options: ['DROP', 'DOWNGRADE', 'KEEP'] } },
            },
        },
        phase: { school: 'POLARIZED' },
        aiRequest: { input: { anchor: null } },
        sessions: [hard, foundation],
        ...overrides,
    };
}

function post(body: unknown, id = userId) {
    const request = new Request('http://test', { method: 'POST', body: JSON.stringify(body) });
    return POST({ request, params: { id, weekId: 'week-1' }, locals });
}

beforeEach(() => {
    prismaMocks.getAthleteProfile.mockResolvedValue({ userId, hrZoneBounds: zonesFromMaxHr(190) });
    db.$transaction.mockImplementation((fn: (t: typeof tx) => unknown) => fn(tx));
    db.planWeek.findUnique.mockResolvedValue(week());
    tx.planWeek.updateMany.mockResolvedValue({ count: 1 });
});

afterEach(() => vi.clearAllMocks());

describe('POST /api/user/[id]/plan/weeks/[weekId]/decision', () => {
    it('returns 403 for another user', async () => {
        expect((await post({ choice: 'KEEP' }, 'someone-else')).status).toBe(403);
    });

    it('returns 404 for a week the athlete does not own', async () => {
        db.planWeek.findUnique.mockResolvedValueOnce(week({ userId: 'someone-else' }));
        expect((await post({ choice: 'KEEP' })).status).toBe(404);
    });

    it('rejects an unknown choice', async () => {
        expect((await post({ choice: 'MAYBE' })).status).toBe(400);
    });

    it('answers 409 when no ask is pending', async () => {
        db.planWeek.findUnique.mockResolvedValueOnce(week({ decision: 'KEPT' }));
        expect((await post({ choice: 'KEEP' })).status).toBe(409);
        expect(db.$transaction).not.toHaveBeenCalled();
    });

    it('rejects a choice that was not offered', async () => {
        const noDowngrade = week();
        noDowngrade.conflict.budget.facts.offered.options = ['DROP', 'KEEP'];
        db.planWeek.findUnique.mockResolvedValueOnce(noDowngrade);
        expect((await post({ choice: 'DOWNGRADE' })).status).toBe(400);
    });

    it('records a keep on this week only and leaves every session as written', async () => {
        const response = await post({ choice: 'KEEP' });
        expect(response.status).toBe(200);
        expect(tx.planWeek.updateMany).toHaveBeenCalledWith({
            where: { id: 'week-1', decision: 'PENDING' },
            data: { decision: 'KEPT' },
        });
        expect(tx.plannedSession.deleteMany).not.toHaveBeenCalled();
        expect(tx.plannedSession.update).not.toHaveBeenCalled();
    });

    it('drops the key session together with the easy volume trimmed with it', async () => {
        await post({ choice: 'DROP' });
        expect(tx.planWeek.updateMany.mock.calls[0][0].data).toEqual({ decision: 'DROPPED' });
        expect(tx.plannedSession.deleteMany).toHaveBeenCalledWith({
            where: { id: { in: ['easy-1', 'hard-1'] }, status: 'PLANNED' },
        });
    });

    it('downgrades the key session one label down, recosted, and trims the easy volume', async () => {
        await post({ choice: 'DOWNGRADE' });
        expect(tx.planWeek.updateMany.mock.calls[0][0].data).toEqual({ decision: 'DOWNGRADED' });
        expect(tx.plannedSession.deleteMany).toHaveBeenCalledWith({
            where: { id: { in: ['easy-1'] }, status: 'PLANNED' },
        });
        const { where, data } = tx.plannedSession.update.mock.calls[0][0];
        expect(where).toEqual({ id: 'hard-1' });
        // 15 min z1 ×2 + 4 × (4 min z2 ×3 + 2 min z1 ×2) = 30 + 64
        expect(data.plannedLoad).toBe(94);
        expect(data.body.steps[1].steps[0]).toMatchObject({ label: 'z2', target: { type: 'HR' } });
    });

    it('changes nothing when a concurrent answer won the race', async () => {
        tx.planWeek.updateMany.mockResolvedValueOnce({ count: 0 });
        expect((await post({ choice: 'DROP' })).status).toBe(409);
        expect(tx.plannedSession.deleteMany).not.toHaveBeenCalled();
    });
});
