import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getSchool } from '$lib/planner/schools/catalogue';

vi.mock('$env/static/public', () => ({ PUBLIC_APP_ENV: 'test' }));

const prismaMocks = vi.hoisted(() => ({ getAthleteProfile: vi.fn() }));
vi.mock('$lib/prisma/prisma', () => prismaMocks);

const costContext = vi.hoisted(() => ({ athleteSessionContext: vi.fn() }));
vi.mock('$lib/server/planner/cost-context', () => costContext);

const tx = vi.hoisted(() => ({ plannedSession: { updateMany: vi.fn(), create: vi.fn() } }));
const db = vi.hoisted(() => ({
    $transaction: vi.fn(),
    plan: { findFirst: vi.fn() },
    plannedSession: { findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn(), count: vi.fn() },
}));
vi.mock('$lib/database', () => ({ db }));

import { PATCH } from './+server';

const userId = 'user-1';
const locals = { user: { id: userId } } as unknown as App.Locals;
const d = (iso: string) => new Date(`${iso}T00:00:00Z`);
const school = getSchool('POLARIZED');
const label = school.intensityLabels[0].key;

const aiRun = {
    id: 'ai-1',
    userId,
    kind: 'RUNNING',
    origin: 'AI',
    status: 'PLANNED',
    scheduledDate: d('2026-10-22'),
    sequence: 0,
    activityId: null,
};

const plan = {
    goal: { targetDistanceM: 10000 },
    phases: [
        {
            school: 'POLARIZED',
            weeks: [{ id: 'week-1', startDate: d('2026-10-19'), endDate: d('2026-10-25') }],
        },
    ],
};

const edit = { date: '2026-10-22', title: 'Shorter easy', steps: [{ label, durationSec: 1200 }] };

const call = (body: unknown, id = userId) =>
    PATCH({
        request: new Request('http://x', { method: 'PATCH', body: JSON.stringify(body) }),
        params: { id, sessionId: 'ai-1' },
        locals,
    });

describe('PATCH /api/user/[id]/plan/sessions/[sessionId]', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        prismaMocks.getAthleteProfile.mockResolvedValue({ timezone: 'UTC' });
        costContext.athleteSessionContext.mockResolvedValue({
            cost: { school, paceSecPerKm: null },
            targets: { school, anchor: null, zones: null },
        });
        db.plan.findFirst.mockResolvedValue(plan);
        db.$transaction.mockImplementation((fn: (t: typeof tx) => unknown) => fn(tx));
        tx.plannedSession.updateMany.mockResolvedValue({ count: 1 });
        tx.plannedSession.create.mockResolvedValue({ id: 'athlete-1' });
        db.plannedSession.updateMany.mockResolvedValue({ count: 1 });
    });

    it('supersedes an AI session with an athlete row instead of overwriting it', async () => {
        db.plannedSession.findUnique.mockResolvedValue(aiRun);
        const res = await call(edit);

        expect(res.status).toBe(200);
        expect(await res.json()).toMatchObject({ data: { sessionId: 'athlete-1' } });
        expect(tx.plannedSession.updateMany).toHaveBeenCalledWith({
            where: { id: 'ai-1', status: 'PLANNED' },
            data: { status: 'SUPERSEDED' },
        });
        expect(tx.plannedSession.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                origin: 'ATHLETE',
                supersedesId: 'ai-1',
                kind: 'RUNNING',
                planWeekId: 'week-1',
                body: expect.objectContaining({ title: 'Shorter easy' }),
            }),
            select: { id: true },
        });
        expect(db.plannedSession.update).not.toHaveBeenCalled();
    });

    it('edits an athlete session in place', async () => {
        db.plannedSession.findUnique.mockResolvedValue({ ...aiRun, origin: 'ATHLETE' });
        const res = await call(edit);

        expect(res.status).toBe(200);
        expect(db.plannedSession.updateMany).toHaveBeenCalledWith(
            expect.objectContaining({ where: { id: 'ai-1', status: 'PLANNED' } }),
        );
        expect(tx.plannedSession.create).not.toHaveBeenCalled();
    });

    it('refuses another user', async () => {
        expect((await call(edit, 'someone-else')).status).toBe(403);
    });

    it('treats a session the user does not own as not found', async () => {
        db.plannedSession.findUnique.mockResolvedValue({ ...aiRun, userId: 'someone-else' });
        expect((await call(edit)).status).toBe(404);
        expect(db.$transaction).not.toHaveBeenCalled();
    });

    it('refuses to edit a session already done', async () => {
        db.plannedSession.findUnique.mockResolvedValue({ ...aiRun, status: 'DONE' });
        expect((await call(edit)).status).toBe(409);
    });
});
