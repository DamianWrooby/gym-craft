import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$env/static/public', () => ({ PUBLIC_APP_ENV: 'test' }));

const prismaMocks = vi.hoisted(() => ({ getAthleteProfile: vi.fn() }));
vi.mock('$lib/prisma/prisma', () => prismaMocks);

const tx = vi.hoisted(() => ({
    planWeek: { updateMany: vi.fn(), update: vi.fn() },
    plannedSession: { createMany: vi.fn(), updateMany: vi.fn() },
    aiUsage: { upsert: vi.fn() },
    aiRequest: { update: vi.fn() },
}));
const db = vi.hoisted(() => ({ $transaction: vi.fn(), planWeek: { findUnique: vi.fn() } }));
vi.mock('$lib/database', () => ({ db }));

import { POST } from './+server';

const userId = 'user-1';
const locals = { user: { id: userId } } as unknown as App.Locals;
const day = (d: string) => new Date(`${d}T00:00:00Z`);

const output = JSON.stringify({
    sessions: [
        {
            kind: 'RUNNING',
            date: '2026-10-15',
            title: 'Easy',
            cutKey: 'easy',
            steps: [{ label: 'z1', durationSec: 1800 }],
        },
        {
            kind: 'RUNNING',
            date: '2026-10-18',
            title: 'Long run',
            keySession: 'long',
            steps: [{ label: 'z1', durationSec: 4800 }],
        },
    ],
});

const planned = (id: string, date: string, over: Record<string, unknown> = {}) => ({
    id,
    kind: 'RUNNING',
    origin: 'AI',
    status: 'PLANNED',
    scheduledDate: day(date),
    sequence: 0,
    plannedLoad: 40,
    ...over,
});

function week(request: Record<string, unknown> = {}) {
    return {
        id: 'week-1',
        userId,
        startDate: day('2026-10-12'),
        endDate: day('2026-10-18'),
        recoveryBudget: null,
        revisionGeneration: 'PENDING',
        revisionRequestId: 'request-9',
        revisionReason: {
            outcome: 'revise',
            scope: ['thu', 'sun'],
            from: '2026-10-14',
            executedLoad: 60,
            remainingLoad: 80,
            budget: null,
            overspend: 0,
            missedKeySessions: ['hard'],
        },
        revisionRequest: {
            id: 'request-9',
            status: 'DONE',
            output,
            retryCount: 0,
            input: { anchor: null },
            updatedAt: new Date('2026-10-14T08:59:00Z'),
            ...request,
        },
        sessions: [
            planned('mon', '2026-10-12', { status: 'DONE' }),
            planned('thu', '2026-10-15'),
            planned('sat', '2026-10-17', { origin: 'ATHLETE' }),
            planned('sun', '2026-10-18'),
        ],
        phase: {
            school: 'POLARIZED',
            plan: {
                startDate: day('2026-09-28'),
                endDate: day('2027-01-31'),
                availability: { mon: true, tue: true, wed: true, thu: true, fri: true, sat: true, sun: true },
                longRunDay: 6,
            },
        },
    };
}

const post = (id = userId) =>
    POST({ request: new Request('http://test', { method: 'POST' }), params: { id, weekId: 'week-1' }, locals });

beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-14T09:00:00Z'));
    prismaMocks.getAthleteProfile.mockResolvedValue({ userId, timezone: 'UTC', hrZoneBounds: null });
    db.$transaction.mockImplementation((fn: (t: typeof tx) => unknown) => fn(tx));
    db.planWeek.findUnique.mockResolvedValue(week());
    tx.planWeek.updateMany.mockResolvedValue({ count: 1 });
});

afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
});

describe('POST /api/user/[id]/plan/weeks/[weekId]/revision/finalize', () => {
    it('returns 403 for another user', async () => {
        expect((await post('someone-else')).status).toBe(403);
    });

    it('supersedes the scope and writes replacements that point at it', async () => {
        const res = await post();
        expect((await res.json()).data).toEqual({ revision: 'GENERATED' });
        expect(tx.plannedSession.updateMany).toHaveBeenCalledWith({
            where: { id: { in: ['thu', 'sun'] }, status: 'PLANNED' },
            data: { status: 'SUPERSEDED' },
        });
        const rows = tx.plannedSession.createMany.mock.calls[0][0].data;
        expect(rows.map((r: { supersedesId: string; origin: string }) => [r.supersedesId, r.origin])).toEqual([
            ['thu', 'AI'],
            ['sun', 'AI'],
        ]);
        expect(tx.planWeek.updateMany.mock.calls[0][0].data).toMatchObject({
            revisionGeneration: 'GENERATED',
            revision: { increment: 1 },
        });
    });

    it('counts the revision once, at DONE', async () => {
        await post();
        expect(tx.aiUsage.upsert).toHaveBeenCalledTimes(1);
        expect(tx.aiUsage.upsert.mock.calls[0][0].create).toMatchObject({ kind: 'plan_revision', count: 1 });
    });

    it('is idempotent: a second finalize writes and counts nothing', async () => {
        tx.planWeek.updateMany.mockResolvedValue({ count: 0 });
        await post();
        expect(tx.plannedSession.createMany).not.toHaveBeenCalled();
        expect(tx.aiUsage.upsert).not.toHaveBeenCalled();
    });

    it('a FAILED request is not counted and touches no session', async () => {
        db.planWeek.findUnique.mockResolvedValue(week({ status: 'FAILED', retryCount: 1 }));
        const res = await post();
        expect((await res.json()).data).toEqual({ revision: 'FAILED', retriesLeft: 1 });
        expect(tx.aiUsage.upsert).not.toHaveBeenCalled();
        expect(tx.plannedSession.updateMany).not.toHaveBeenCalled();
        expect(tx.planWeek.update).toHaveBeenCalledWith({
            where: { id: 'week-1' },
            data: { revisionGeneration: 'FAILED' },
        });
    });

    it('an invalid output fails the revision and is not counted', async () => {
        db.planWeek.findUnique.mockResolvedValue(week({ output: 'not json' }));
        const res = await post();
        expect((await res.json()).data.revision).toBe('FAILED');
        expect(tx.aiUsage.upsert).not.toHaveBeenCalled();
    });

    it('rejects a session before the revision day', async () => {
        const early = JSON.stringify({
            sessions: [
                { kind: 'RUNNING', date: '2026-10-13', title: 'Easy', steps: [{ label: 'z1', durationSec: 1800 }] },
            ],
        });
        db.planWeek.findUnique.mockResolvedValue(week({ output: early }));
        expect((await (await post()).json()).data.revision).toBe('FAILED');
    });

    it('reports a request still running', async () => {
        db.planWeek.findUnique.mockResolvedValue(week({ status: 'RUNNING', updatedAt: new Date() }));
        expect((await (await post()).json()).data).toMatchObject({ revision: 'PENDING' });
    });
});
