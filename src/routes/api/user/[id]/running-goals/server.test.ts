import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('$env/static/public', () => ({ PUBLIC_APP_ENV: 'test' }));

const mocks = vi.hoisted(() => ({
    getRunningGoals: vi.fn(),
    createRunningGoal: vi.fn(),
    updateRunningGoal: vi.fn(),
    archiveRunningGoal: vi.fn(),
}));

vi.mock('$lib/prisma/prisma', () => mocks);

import { GET, POST } from './+server';
import { PUT, DELETE } from './[goalId]/+server';
import { validateRunningGoalInput } from '$lib/server/running-goals/validation';

const userId = 'user-1';
const locals = { user: { id: userId } } as unknown as App.Locals;

function makeRequest(body: unknown): Request {
    return new Request('http://test/api/user/user-1/running-goals', {
        method: 'POST',
        body: JSON.stringify(body),
    });
}

const validCreate = {
    goalType: 'RACE',
    targetEventName: 'Berlin Marathon',
    targetEventDate: '2026-09-27',
    targetDistanceM: 42195,
    targetTimeSec: 13500,
    priority: 1,
    notes: 'Plan A',
};

afterEach(() => {
    vi.clearAllMocks();
});

describe('GET /running-goals', () => {
    it('returns 403 for wrong user', async () => {
        const url = new URL('http://test/api/user/someone-else/running-goals');
        const response = await GET({ params: { id: 'someone-else' }, locals, url });
        expect(response.status).toBe(403);
    });

    it('returns active goals by default', async () => {
        mocks.getRunningGoals.mockResolvedValueOnce([{ id: 'g1' }]);
        const url = new URL('http://test/api/user/user-1/running-goals');
        const response = await GET({ params: { id: userId }, locals, url });
        expect(response.status).toBe(200);
        expect(mocks.getRunningGoals).toHaveBeenCalledWith(userId, { includeArchived: false });
    });

    it('passes includeArchived=true through to the helper', async () => {
        mocks.getRunningGoals.mockResolvedValueOnce([]);
        const url = new URL('http://test/api/user/user-1/running-goals?includeArchived=true');
        await GET({ params: { id: userId }, locals, url });
        expect(mocks.getRunningGoals).toHaveBeenCalledWith(userId, { includeArchived: true });
    });
});

describe('POST /running-goals', () => {
    it('returns 403 for wrong user', async () => {
        const response = await POST({ request: makeRequest(validCreate), params: { id: 'other' }, locals });
        expect(response.status).toBe(403);
        expect(mocks.createRunningGoal).not.toHaveBeenCalled();
    });

    it('returns 400 when goalType is missing', async () => {
        const { goalType, ...rest } = validCreate;
        void goalType;
        const response = await POST({ request: makeRequest(rest), params: { id: userId }, locals });
        expect(response.status).toBe(400);
    });

    it('returns 400 for unknown goalType', async () => {
        const response = await POST({
            request: makeRequest({ ...validCreate, goalType: 'BANANA' }),
            params: { id: userId },
            locals,
        });
        expect(response.status).toBe(400);
    });

    it('creates the goal on a valid POST', async () => {
        mocks.createRunningGoal.mockResolvedValueOnce({ id: 'g1', ...validCreate });
        const response = await POST({ request: makeRequest(validCreate), params: { id: userId }, locals });
        expect(response.status).toBe(201);
        expect(mocks.createRunningGoal).toHaveBeenCalledWith(userId, expect.objectContaining({ goalType: 'RACE' }));
    });
});

describe('PUT /running-goals/[goalId]', () => {
    it('returns 403 for wrong user, never touching DB', async () => {
        const response = await PUT({
            request: new Request('http://test', { method: 'PUT', body: JSON.stringify({ priority: 2 }) }),
            params: { id: 'other', goalId: 'g1' },
            locals,
        });
        expect(response.status).toBe(403);
        expect(mocks.updateRunningGoal).not.toHaveBeenCalled();
    });

    it('returns 404 when goal is not owned (updateMany found nothing)', async () => {
        mocks.updateRunningGoal.mockResolvedValueOnce(null);
        const response = await PUT({
            request: new Request('http://test', { method: 'PUT', body: JSON.stringify({ priority: 2 }) }),
            params: { id: userId, goalId: 'foreign-goal' },
            locals,
        });
        expect(response.status).toBe(404);
    });

    it('updates the goal on success', async () => {
        mocks.updateRunningGoal.mockResolvedValueOnce({ id: 'g1', priority: 2 });
        const response = await PUT({
            request: new Request('http://test', { method: 'PUT', body: JSON.stringify({ priority: 2 }) }),
            params: { id: userId, goalId: 'g1' },
            locals,
        });
        expect(response.status).toBe(200);
        expect(mocks.updateRunningGoal).toHaveBeenCalledWith('g1', userId, { priority: 2 });
    });
});

describe('DELETE /running-goals/[goalId]', () => {
    it('returns 403 for wrong user', async () => {
        const response = await DELETE({ params: { id: 'other', goalId: 'g1' }, locals });
        expect(response.status).toBe(403);
        expect(mocks.archiveRunningGoal).not.toHaveBeenCalled();
    });

    it('returns 404 when goal does not exist or is already archived', async () => {
        mocks.archiveRunningGoal.mockResolvedValueOnce(false);
        const response = await DELETE({ params: { id: userId, goalId: 'g1' }, locals });
        expect(response.status).toBe(404);
    });

    it('archives the goal on success', async () => {
        mocks.archiveRunningGoal.mockResolvedValueOnce(true);
        const response = await DELETE({ params: { id: userId, goalId: 'g1' }, locals });
        expect(response.status).toBe(200);
        expect(mocks.archiveRunningGoal).toHaveBeenCalledWith('g1', userId);
    });
});

describe('validateRunningGoalInput', () => {
    it('accepts a full valid create payload', () => {
        const result = validateRunningGoalInput(validCreate, { partial: false });
        expect('input' in result).toBe(true);
    });

    it('rejects negative priority', () => {
        const result = validateRunningGoalInput({ ...validCreate, priority: 0 }, { partial: false });
        expect('error' in result).toBe(true);
    });

    it('rejects notes longer than 500 chars', () => {
        const result = validateRunningGoalInput(
            { ...validCreate, notes: 'x'.repeat(501) },
            { partial: false },
        );
        expect('error' in result).toBe(true);
    });

    it('accepts null for optional fields in partial updates', () => {
        const result = validateRunningGoalInput(
            { targetEventName: null, targetEventDate: null, targetDistanceM: null, targetTimeSec: null, notes: null },
            { partial: true },
        );
        expect('input' in result).toBe(true);
    });

    it('rejects bad targetEventDate format', () => {
        const result = validateRunningGoalInput({ ...validCreate, targetEventDate: 'Sept 27' }, { partial: false });
        expect('error' in result).toBe(true);
    });
});
