import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$env/static/public', () => ({ PUBLIC_APP_ENV: 'test' }));

const mocks = vi.hoisted(() => ({
    addPlan: vi.fn(),
    getGeneralPlanLimit: vi.fn(),
    getGeneratedPlansNumber: vi.fn(),
    updateGeneratedPlansNumber: vi.fn(),
    getMonthlyGymPlanCount: vi.fn(),
    incrementMonthlyGymPlanCount: vi.fn(),
}));

vi.mock('$lib/prisma/prisma', () => ({
    addPlan: mocks.addPlan,
    getGeneralPlanLimit: mocks.getGeneralPlanLimit,
    getGeneratedPlansNumber: mocks.getGeneratedPlansNumber,
    updateGeneratedPlansNumber: mocks.updateGeneratedPlansNumber,
    getMonthlyGymPlanCount: mocks.getMonthlyGymPlanCount,
    incrementMonthlyGymPlanCount: mocks.incrementMonthlyGymPlanCount,
}));

import { POST } from './+server';

const plan = { description: 'desc', workouts: [] };

function makeEvent(tier: 'FREE' | 'SUPPORTER') {
    return {
        request: new Request('http://localhost/api/plans', { method: 'POST', body: JSON.stringify({ plan }) }),
        locals: { user: { id: 'user-1', name: 'u', role: 'USER', subscriptionTier: tier } },
    } as never;
}

beforeEach(() => {
    mocks.getGeneralPlanLimit.mockResolvedValue(10);
    mocks.getGeneratedPlansNumber.mockResolvedValue(3);
    mocks.getMonthlyGymPlanCount.mockResolvedValue(0);
    mocks.addPlan.mockResolvedValue({ id: 'plan-1' });
    mocks.updateGeneratedPlansNumber.mockResolvedValue(4);
    mocks.incrementMonthlyGymPlanCount.mockResolvedValue(undefined);
});

afterEach(() => vi.clearAllMocks());

describe('POST /api/plans — FREE tier (lifetime cap)', () => {
    it('saves the plan and returns lifetime plansLeft', async () => {
        const res = await POST(makeEvent('FREE'));
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.plansLeft).toBe(6); // 10 - 4
        expect(mocks.incrementMonthlyGymPlanCount).not.toHaveBeenCalled();
    });

    it('rejects when the lifetime cap is reached', async () => {
        mocks.getGeneratedPlansNumber.mockResolvedValue(10);
        const res = await POST(makeEvent('FREE'));
        expect(res.status).toBe(400);
        expect(mocks.addPlan).not.toHaveBeenCalled();
    });
});

describe('POST /api/plans — SUPPORTER tier (monthly cap)', () => {
    it('saves the plan, increments the monthly counter, and returns monthly plansLeft', async () => {
        mocks.getMonthlyGymPlanCount.mockResolvedValue(2);
        const res = await POST(makeEvent('SUPPORTER'));
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.plansLeft).toBe(2); // 5 - (2 + 1)
        expect(mocks.incrementMonthlyGymPlanCount).toHaveBeenCalledWith('user-1');
    });

    it('rejects when the monthly cap is reached', async () => {
        mocks.getMonthlyGymPlanCount.mockResolvedValue(5);
        const res = await POST(makeEvent('SUPPORTER'));
        expect(res.status).toBe(400);
        expect(mocks.addPlan).not.toHaveBeenCalled();
    });

    it('ignores the lifetime counter for supporters', async () => {
        mocks.getGeneratedPlansNumber.mockResolvedValue(10); // over lifetime cap
        mocks.getMonthlyGymPlanCount.mockResolvedValue(0);
        const res = await POST(makeEvent('SUPPORTER'));
        expect(res.status).toBe(200);
    });
});
