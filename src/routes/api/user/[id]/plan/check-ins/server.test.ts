import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$env/static/public', () => ({ PUBLIC_APP_ENV: 'test' }));

const db = vi.hoisted(() => ({
    athleteProfile: { findUnique: vi.fn() },
    wellbeingCheckIn: { upsert: vi.fn() },
}));
vi.mock('$lib/database', () => ({ db }));

import { POST } from './+server';

const userId = 'user-1';
const locals = { user: { id: userId } } as unknown as App.Locals;

const post = (body: unknown, id = userId) =>
    POST({ request: new Request('http://x', { method: 'POST', body: JSON.stringify(body) }), params: { id }, locals });

beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-14T23:30:00Z'));
    db.athleteProfile.findUnique.mockResolvedValue({ timezone: 'Europe/Warsaw' });
});

afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
});

describe('POST /api/user/[id]/plan/check-ins', () => {
    it('returns 403 for another user', async () => {
        expect((await post({ feeling: 'GOOD' }, 'someone-else')).status).toBe(403);
    });

    it("records today's check-in in the athlete's timezone, one per day", async () => {
        const res = await post({ feeling: 'POOR', reason: 'ILL' });
        expect(res.status).toBe(200);
        const date = new Date('2026-10-15T00:00:00Z');
        expect(db.wellbeingCheckIn.upsert).toHaveBeenCalledWith({
            where: { userId_date: { userId, date } },
            create: { userId, date, feeling: 'POOR', reason: 'ILL' },
            update: { feeling: 'POOR', reason: 'ILL' },
        });
    });

    it('rejects an unknown feeling', async () => {
        expect((await post({ feeling: 'MEH' })).status).toBe(400);
        expect(db.wellbeingCheckIn.upsert).not.toHaveBeenCalled();
    });
});
