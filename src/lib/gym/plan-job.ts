import { get, writable } from 'svelte/store';
import { to } from 'await-to-js';
import { loadingState } from '@/stores';
import { appConfig } from '@/constants/app.constants';
import type { Plan } from '@models/plan/plan.model';
import type { SurveyFormModel } from '@/models/survey/survey-form.model';
import { generatePlan, isRetryableCode, type GeneratePlanErrorCode } from './generate-plan';
import { correctPlan, isValidPlan } from './plan-validation';

/*
 * Plan generation as a client-side background job (#281).
 *
 * The job lives in this module, not in the create-plan page, so it keeps running when
 * the user navigates elsewhere inside the app. PlanJobWatcher (mounted in the app
 * layout) reacts to the finished job: it opens the plan, or shows a toast with a link.
 * Closing or reloading the tab still cancels the job — the work runs in the browser.
 */

export type PlanJobFailureCode = GeneratePlanErrorCode | 'INVALID_PLAN' | 'SAVE_FAILED';

export type PlanJobState =
    | { status: 'idle' }
    | { status: 'running'; startedAt: number }
    | { status: 'done'; planId: string; finishedAt: number }
    | { status: 'failed'; code: PlanJobFailureCode; message: string; formData: SurveyFormModel };

export const planJob = writable<PlanJobState>({ status: 'idle' });

const RETRY_COUNT = 2;

type Attempt = { ok: true; plan: Plan } | { ok: false; code: PlanJobFailureCode; message: string };

export function isPlanJobRunning(): boolean {
    return get(planJob).status === 'running';
}

/** Starts a job unless one is already running. Returns false when it did not start. */
export function startPlanJob(proxyUrl: string, session: string, formData: SurveyFormModel): boolean {
    if (isPlanJobRunning()) return false;
    planJob.set({ status: 'running', startedAt: Date.now() });
    loadingState.set(true);
    void runPlanJob(proxyUrl, session, formData);
    return true;
}

export function resetPlanJob(): void {
    planJob.set({ status: 'idle' });
}

async function runPlanJob(proxyUrl: string, session: string, formData: SurveyFormModel): Promise<void> {
    const attempt = await generateValidPlan(proxyUrl, session, formData);
    if (!attempt.ok) {
        finish({ status: 'failed', code: attempt.code, message: attempt.message, formData });
        return;
    }

    const [saveError, response] = await to(
        fetch(appConfig.plansApiUrl, { method: 'POST', body: JSON.stringify({ plan: attempt.plan }) }),
    );
    if (saveError || !response?.ok) {
        const body = response ? await response.json().catch(() => null) : null;
        finish({
            status: 'failed',
            code: 'SAVE_FAILED',
            message: body?.message ?? saveError?.message ?? 'Cannot save the plan',
            formData,
        });
        return;
    }

    const { generatedPlan } = await response.json();
    finish({ status: 'done', planId: generatedPlan.id, finishedAt: Date.now() });
}

function finish(state: PlanJobState): void {
    loadingState.set(false);
    planJob.set(state);
}

async function generateValidPlan(url: string, session: string, formData: SurveyFormModel): Promise<Attempt> {
    let lastFailure: Attempt = { ok: false, code: 'PROXY_ERROR', message: 'Plan generation was not attempted' };

    for (let i = 0; i < RETRY_COUNT; i++) {
        const result = await generatePlan(url, session, formData);

        if (!result.ok) {
            // A rejected session or a rejected payload returns the same answer every time —
            // burning the retries on them only delays the message the user needs.
            if (!isRetryableCode(result.code)) return result;
            lastFailure = result;
            continue;
        }

        const improvedPlan = correctPlan(result.plan);
        if (isValidPlan(improvedPlan)) return { ok: true, plan: improvedPlan };
        lastFailure = { ok: false, code: 'INVALID_PLAN', message: 'Generated plan failed validation' };
    }

    return lastFailure;
}

export function planFailureMessage(code: PlanJobFailureCode): string {
    if (code === 'INVALID_FORM_DATA') {
        return 'We could not process your survey answers <br> Please try again or contact support';
    }
    if (code === 'PROXY_ERROR') {
        // Network fault, or the proxy/OpenAI itself failing — nothing was wrong with the
        // answers, so say that rather than implying the plan came back and failed validation.
        return 'We could not reach the plan generator <br> Please try again in a moment';
    }
    if (code === 'SAVE_FAILED') return 'Cannot generate the plan <br> Please try again';
    return 'Failed to generate a valid plan after maximum retries';
}
