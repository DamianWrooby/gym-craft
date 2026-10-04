import { readonly, writable } from 'svelte/store';
import { to } from 'await-to-js';
import { PUBLIC_APP_ENV } from '$env/static/public';
import { appConfig } from '@/constants/app.constants';
import type { Plan } from '@models/plan/plan.model';
import type { SurveyFormModel } from '@/models/survey/survey-form.model';
import { generatePlan, isRetryableCode, type GeneratePlanErrorCode } from './generate-plan';
import { correctPlan, isValidPlan } from './plan-validation';
import { readApiError } from '$lib/utils/api-error';

/*
 * Plan generation as a client-side background job (#281).
 *
 * The job lives in this module, not in the create-plan page, so it keeps running when the user
 * navigates elsewhere inside the app. Closing or reloading the tab still cancels it — the work
 * runs in the browser.
 *
 * Interface: start a job, read whether one is running, and hear about each finished job exactly
 * once. PlanJobWatcher (in the app layout) is the one listener that turns outcomes into UI.
 */

export type PlanJobFailureCode = GeneratePlanErrorCode | 'INVALID_PLAN' | 'SAVE_FAILED';

export type PlanJobOutcome =
    | { status: 'done'; planId: string }
    | { status: 'failed'; code: PlanJobFailureCode; message: string; formData: SurveyFormModel };

const RETRY_COUNT = 2;

const running = writable(false);
/** True while a plan is being generated or saved. */
export const planJobRunning = readonly(running);

type Listener = (outcome: PlanJobOutcome) => void;
const listeners = new Set<Listener>();
/** An outcome that finished while nobody listened; handed to the next listener, once. */
let undelivered: PlanJobOutcome | null = null;

/**
 * Calls `handler` once for every job that finishes from now on. Returns the unsubscribe function.
 * An outcome that finished with no listener attached is delivered to the first one that subscribes.
 */
export function onPlanJobFinished(handler: Listener): () => void {
    listeners.add(handler);
    if (undelivered) {
        const outcome = undelivered;
        undelivered = null;
        handler(outcome);
    }
    return () => listeners.delete(handler);
}

/** Starts a job unless one is already running. Returns false when it did not start. */
export function startPlanJob(session: string, formData: SurveyFormModel): boolean {
    let started = false;
    running.update((isRunning) => {
        started = !isRunning;
        return true;
    });
    if (!started) return false;

    const proxyUrl = PUBLIC_APP_ENV === 'development' ? appConfig.proxyApiUrlDEV : appConfig.proxyApiUrlPROD;
    void runPlanJob(proxyUrl, session, formData).then(finish);
    return true;
}

function finish(outcome: PlanJobOutcome): void {
    running.set(false);
    if (listeners.size === 0) {
        undelivered = outcome;
        return;
    }
    listeners.forEach((listener) => listener(outcome));
}

type Attempt = { ok: true; plan: Plan } | { ok: false; code: PlanJobFailureCode; message: string };

async function runPlanJob(proxyUrl: string, session: string, formData: SurveyFormModel): Promise<PlanJobOutcome> {
    const attempt = await generateValidPlan(proxyUrl, session, formData);
    if (!attempt.ok) return { status: 'failed', code: attempt.code, message: attempt.message, formData };

    const [saveError, response] = await to(
        fetch(appConfig.plansApiUrl, { method: 'POST', body: JSON.stringify({ plan: attempt.plan }) }),
    );
    if (saveError || !response?.ok) {
        const fallback = saveError?.message ?? 'Cannot save the plan';
        const { message } = response ? await readApiError(response, fallback) : { message: fallback };
        return { status: 'failed', code: 'SAVE_FAILED', message, formData };
    }

    const { generatedPlan } = await response.json();
    return { status: 'done', planId: generatedPlan.id };
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
