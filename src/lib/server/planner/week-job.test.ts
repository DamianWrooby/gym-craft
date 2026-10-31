import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$env/static/public', () => ({ PUBLIC_APP_ENV: 'test' }));

type Row = Record<string, unknown>;

/** An in-memory stand-in for the few Prisma calls a week job makes. */
const fake = vi.hoisted(() => {
    const weeks = new Map<string, Row>();
    const requests = new Map<string, Row>();
    const matches = (row: Row, where: Row) => Object.entries(where).every(([k, v]) => row[k] === v);
    const client = {
        planWeek: {
            findUnique: async ({ where }: { where: { id: string } }) => {
                const week = weeks.get(where.id);
                if (!week) return null;
                const req = (id: unknown) => (typeof id === 'string' ? { ...requests.get(id) } : null);
                return { ...week, aiRequest: req(week.aiRequestId), revisionRequest: req(week.revisionRequestId) };
            },
            update: async ({ where, data }: { where: { id: string }; data: Row }) => {
                Object.assign(weeks.get(where.id)!, data);
            },
        },
        aiRequest: {
            update: async ({ where, data }: { where: { id: string }; data: Row }) => {
                Object.assign(requests.get(where.id)!, data);
            },
            updateMany: async ({ where, data }: { where: Row; data: Row }) => {
                const row = requests.get(where.id as string);
                if (!row || !matches(row, where)) return { count: 0 };
                Object.assign(row, data);
                return { count: 1 };
            },
        },
    };
    const db = { ...client, $transaction: async (fn: (tx: typeof client) => unknown) => fn(client) };
    return { weeks, requests, db };
});
vi.mock('$lib/database', () => ({ db: fake.db }));

import { awaitsFinalize, finalizeJob, finalizeResponse, retryJob, retryResponse, type WeekSlot } from './week-job';

const userId = 'user-1';
const now = new Date('2026-10-14T09:00:00Z');
const minutesAgo = (m: number) => new Date(now.getTime() - m * 60_000);

function seed(slot: WeekSlot, status: string | null, request: Row | null) {
    const generation = slot === 'generation';
    fake.weeks.set('week-1', {
        id: 'week-1',
        userId,
        generation: generation ? status : 'GENERATED',
        revisionGeneration: generation ? null : status,
        aiRequestId: generation && request ? 'req-1' : null,
        revisionRequestId: !generation && request ? 'req-1' : null,
    });
    if (request) fake.requests.set('req-1', { id: 'req-1', retryCount: 0, updatedAt: minutesAgo(1), ...request });
}

const statusOf = (slot: WeekSlot) =>
    fake.weeks.get('week-1')![slot === 'generation' ? 'generation' : 'revisionGeneration'];
const store = vi.fn(async () => null as string | null);

beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(now);
});

afterEach(() => {
    vi.useRealTimers();
    fake.weeks.clear();
    fake.requests.clear();
    store.mockReset();
    store.mockResolvedValue(null);
});

describe.each<WeekSlot>(['generation', 'revision'])('a %s week job', (slot) => {
    describe('finalize', () => {
        it('hides a week of another user', async () => {
            seed(slot, 'PENDING', { status: 'DONE' });
            expect(await finalizeJob('user-2', 'week-1', slot, store)).toEqual({ kind: 'not-found' });
        });

        it('stores a DONE output once and reports it generated', async () => {
            seed(slot, 'PENDING', { status: 'DONE' });
            expect(await finalizeJob(userId, 'week-1', slot, store)).toEqual({ kind: 'generated' });
            expect(store).toHaveBeenCalledOnce();
        });

        it('fails the request with the error the store returns', async () => {
            seed(slot, 'PENDING', { status: 'DONE' });
            store.mockResolvedValue('bad output');
            expect(await finalizeJob(userId, 'week-1', slot, store)).toEqual({ kind: 'failed', retriesLeft: 2 });
            expect(fake.requests.get('req-1')).toMatchObject({ status: 'FAILED', error: 'bad output' });
            expect(statusOf(slot)).toBe('FAILED');
        });

        it('waits on a request still running', async () => {
            seed(slot, 'PENDING', { status: 'RUNNING' });
            expect(await finalizeJob(userId, 'week-1', slot, store)).toEqual({
                kind: 'pending',
                requestStatus: 'RUNNING',
            });
            expect(store).not.toHaveBeenCalled();
        });

        it.each([
            ['RUNNING', 'Stalled: the proxy never wrote a result'],
            ['PENDING', 'Stalled: the proxy call never started'],
        ])('fails a stale %s request', async (status, error) => {
            seed(slot, 'PENDING', { status, updatedAt: minutesAgo(10) });
            expect(await finalizeJob(userId, 'week-1', slot, store)).toMatchObject({ kind: 'failed' });
            expect(fake.requests.get('req-1')).toMatchObject({ status: 'FAILED', error });
        });

        it('marks the week failed when the proxy failed the request', async () => {
            seed(slot, 'PENDING', { status: 'FAILED', error: 'proxy', retryCount: 1 });
            expect(await finalizeJob(userId, 'week-1', slot, store)).toEqual({ kind: 'failed', retriesLeft: 1 });
            expect(fake.requests.get('req-1')!.error).toBe('proxy');
            expect(statusOf(slot)).toBe('FAILED');
        });
    });

    describe('retry', () => {
        it('re-opens a failed request and counts the retry', async () => {
            seed(slot, 'FAILED', { status: 'FAILED', output: 'x', error: 'e' });
            expect(await retryJob(userId, 'week-1', slot)).toEqual({
                kind: 'retrying',
                aiRequestId: 'req-1',
                retriesLeft: 1,
            });
            expect(fake.requests.get('req-1')).toMatchObject({ status: 'PENDING', output: null, retryCount: 1 });
            expect(statusOf(slot)).toBe('PENDING');
        });

        it('refuses past the cap', async () => {
            seed(slot, 'FAILED', { status: 'FAILED', retryCount: 2 });
            expect(await retryJob(userId, 'week-1', slot)).toEqual({ kind: 'limit' });
        });

        it('refuses a job that has not failed', async () => {
            seed(slot, 'PENDING', { status: 'RUNNING' });
            expect(await retryJob(userId, 'week-1', slot)).toEqual({ kind: 'not-failed' });
        });

        it('lets only one of two parallel retries through', async () => {
            seed(slot, 'FAILED', { status: 'FAILED' });
            const results = await Promise.all([retryJob(userId, 'week-1', slot), retryJob(userId, 'week-1', slot)]);
            expect(results.map((r) => r.kind).sort()).toEqual(['not-failed', 'retrying']);
            expect(fake.requests.get('req-1')!.retryCount).toBe(1);
        });
    });
});

describe('responses', () => {
    it('names the slot in the finalize body', async () => {
        const res = finalizeResponse('revision', { kind: 'pending', requestStatus: 'RUNNING' });
        expect(res.status).toBe(202);
        expect((await res.json()).data).toEqual({ revision: 'PENDING', requestStatus: 'RUNNING' });
    });

    it('names the slot in the retry messages', async () => {
        expect((await retryResponse('generation', { kind: 'not-failed' }).json()).message).toBe(
            'Only a failed week can be retried',
        );
        const limit = retryResponse('revision', { kind: 'limit' });
        expect(limit.status).toBe(429);
        expect((await limit.json()).message).toBe('This revision was already retried 2 times');
    });
});

describe('awaitsFinalize', () => {
    const req = (status: string, minutes = 1) => ({ status, updatedAt: minutesAgo(minutes) });

    it.each([
        ['a DONE request', 'PENDING', req('DONE'), true],
        ['a FAILED request the slot has not marked', 'PENDING', req('FAILED'), true],
        ['a stale PENDING request', 'PENDING', req('PENDING', 10), true],
        ['a stale RUNNING request', 'PENDING', req('RUNNING', 10), true],
        ['a request still running', 'PENDING', req('RUNNING'), false],
        ['a FAILED request the slot has marked', 'FAILED', req('FAILED'), false],
        ['a generated slot', 'GENERATED', req('DONE'), false],
        ['a slot with no request', 'PENDING', null, false],
    ])('%s: %s', (_, status, request, expected) => {
        expect(awaitsFinalize(status, request)).toBe(expected);
    });
});
