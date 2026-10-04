import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { get } from 'svelte/store';

const mocks = vi.hoisted(() => ({ generatePlan: vi.fn() }));

vi.mock('$env/static/public', () => ({ PUBLIC_APP_ENV: 'development' }));
vi.mock('./generate-plan', () => ({
    generatePlan: mocks.generatePlan,
    isRetryableCode: (code: string) => code === 'PROXY_ERROR',
}));
vi.mock('./plan-validation', () => ({
    correctPlan: (plan: unknown) => plan,
    isValidPlan: (plan: { valid?: boolean }) => plan.valid !== false,
}));

import { appConfig } from '@/constants/app.constants';
import { onPlanJobFinished, planJobRunning, startPlanJob, type PlanJobOutcome } from './plan-job';

const formData = {} as never;
const fetchMock = vi.fn();
let outcomes: PlanJobOutcome[];
let unsubscribe: () => void;

async function settle() {
    for (let i = 0; i < 10; i++) await Promise.resolve();
    await new Promise((r) => setTimeout(r, 0));
}

beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    outcomes = [];
    unsubscribe = onPlanJobFinished((outcome) => outcomes.push(outcome));
});

afterEach(async () => {
    await settle();
    unsubscribe();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
});

describe('plan job', () => {
    it('generates against the environment proxy, saves, and reports the plan id once', async () => {
        mocks.generatePlan.mockResolvedValue({ ok: true, plan: { workouts: [] } });
        fetchMock.mockResolvedValue(new Response(JSON.stringify({ generatedPlan: { id: 'plan-9' } })));

        expect(startPlanJob('session', formData)).toBe(true);
        expect(get(planJobRunning)).toBe(true);
        expect(mocks.generatePlan).toHaveBeenCalledWith(appConfig.proxyApiUrlDEV, 'session', formData);

        await settle();
        expect(get(planJobRunning)).toBe(false);
        expect(outcomes).toEqual([{ status: 'done', planId: 'plan-9' }]);
    });

    it('does not start a second job while one runs', async () => {
        let release: (value: unknown) => void = () => {};
        mocks.generatePlan.mockReturnValue(new Promise((r) => (release = r)));
        expect(startPlanJob('session', formData)).toBe(true);
        expect(startPlanJob('session', formData)).toBe(false);
        expect(mocks.generatePlan).toHaveBeenCalledOnce();
        release({ ok: false, code: 'INVALID_SESSION', message: 'x' });
    });

    it('stops at once on an expired session', async () => {
        mocks.generatePlan.mockResolvedValue({ ok: false, code: 'INVALID_SESSION', message: 'x' });
        startPlanJob('session', formData);
        await settle();
        expect(mocks.generatePlan).toHaveBeenCalledOnce();
        expect(outcomes).toEqual([{ status: 'failed', code: 'INVALID_SESSION', message: 'x', formData }]);
    });

    it('retries proxy errors, then fails', async () => {
        mocks.generatePlan.mockResolvedValue({ ok: false, code: 'PROXY_ERROR', message: 'down' });
        startPlanJob('session', formData);
        await settle();
        expect(mocks.generatePlan).toHaveBeenCalledTimes(2);
        expect(outcomes[0]).toMatchObject({ status: 'failed', code: 'PROXY_ERROR' });
    });

    it('reports SAVE_FAILED with the API message when saving fails', async () => {
        mocks.generatePlan.mockResolvedValue({ ok: true, plan: { workouts: [] } });
        fetchMock.mockResolvedValue(new Response(JSON.stringify({ message: 'limit' }), { status: 400 }));
        startPlanJob('session', formData);
        await settle();
        expect(outcomes[0]).toMatchObject({ status: 'failed', code: 'SAVE_FAILED', message: 'limit' });
    });

    it('keeps an outcome that finished with no listener and hands it to the next one, once', async () => {
        unsubscribe();
        mocks.generatePlan.mockResolvedValue({ ok: false, code: 'INVALID_SESSION', message: 'x' });
        startPlanJob('session', formData);
        await settle();

        const late: PlanJobOutcome[] = [];
        const stopLate = onPlanJobFinished((o) => late.push(o));
        const stopLater = onPlanJobFinished((o) => late.push(o));
        expect(late).toHaveLength(1);
        stopLate();
        stopLater();
    });
});
