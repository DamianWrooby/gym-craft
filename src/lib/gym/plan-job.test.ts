import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { get, writable } from 'svelte/store';

const mocks = vi.hoisted(() => ({ generatePlan: vi.fn() }));

vi.mock('@/stores', () => ({ loadingState: writable(false) }));
vi.mock('./generate-plan', () => ({
    generatePlan: mocks.generatePlan,
    isRetryableCode: (code: string) => code === 'PROXY_ERROR',
}));
vi.mock('./plan-validation', () => ({
    correctPlan: (plan: unknown) => plan,
    isValidPlan: (plan: { valid?: boolean }) => plan.valid !== false,
}));

import { loadingState } from '@/stores';
import { planJob, resetPlanJob, startPlanJob } from './plan-job';

const formData = {} as never;
const fetchMock = vi.fn();

async function settle() {
    for (let i = 0; i < 10; i++) await Promise.resolve();
    await new Promise((r) => setTimeout(r, 0));
}

beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    resetPlanJob();
});

afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
});

describe('plan job', () => {
    it('generates, saves, and reports the new plan id', async () => {
        mocks.generatePlan.mockResolvedValue({ ok: true, plan: { workouts: [] } });
        fetchMock.mockResolvedValue(new Response(JSON.stringify({ generatedPlan: { id: 'plan-9' } })));

        expect(startPlanJob('proxy', 'session', formData)).toBe(true);
        expect(get(planJob).status).toBe('running');
        expect(get(loadingState)).toBe(true);

        await settle();
        expect(get(planJob)).toMatchObject({ status: 'done', planId: 'plan-9' });
        expect(get(loadingState)).toBe(false);
    });

    it('does not start a second job while one runs', () => {
        mocks.generatePlan.mockReturnValue(new Promise(() => {}));
        expect(startPlanJob('proxy', 'session', formData)).toBe(true);
        expect(startPlanJob('proxy', 'session', formData)).toBe(false);
        expect(mocks.generatePlan).toHaveBeenCalledOnce();
    });

    it('stops at once on an expired session', async () => {
        mocks.generatePlan.mockResolvedValue({ ok: false, code: 'INVALID_SESSION', message: 'x' });
        startPlanJob('proxy', 'session', formData);
        await settle();
        expect(mocks.generatePlan).toHaveBeenCalledOnce();
        expect(get(planJob)).toMatchObject({ status: 'failed', code: 'INVALID_SESSION' });
    });

    it('retries proxy errors, then fails', async () => {
        mocks.generatePlan.mockResolvedValue({ ok: false, code: 'PROXY_ERROR', message: 'down' });
        startPlanJob('proxy', 'session', formData);
        await settle();
        expect(mocks.generatePlan).toHaveBeenCalledTimes(2);
        expect(get(planJob)).toMatchObject({ status: 'failed', code: 'PROXY_ERROR' });
    });

    it('reports SAVE_FAILED with the API message when saving fails', async () => {
        mocks.generatePlan.mockResolvedValue({ ok: true, plan: { workouts: [] } });
        fetchMock.mockResolvedValue(new Response(JSON.stringify({ message: 'limit' }), { status: 400 }));
        startPlanJob('proxy', 'session', formData);
        await settle();
        expect(get(planJob)).toMatchObject({ status: 'failed', code: 'SAVE_FAILED', message: 'limit' });
        expect(fetchMock).toHaveBeenCalledOnce();
    });
});
