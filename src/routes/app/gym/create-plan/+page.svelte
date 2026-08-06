<script lang="ts">
    import { page } from '$app/stores';
    import { loadingState } from '@/stores';
    import { onMount } from 'svelte';
    import { to } from 'await-to-js';
    import SurveyForm from '@components/survey/SurveyForm.svelte';
    import Loader from '@components/loading/loader/Loader.svelte';
    import { makeToast, makeUpgradeToast } from '$lib/utils/toasts';
    import { getToastStore } from '@skeletonlabs/skeleton';
    import { appConfig } from '@/constants/app.constants';
    import type { SurveyFormModel } from '@/models/survey/survey-form.model';
    import type { User } from '@/models/user/user.model';
    import { goto } from '$app/navigation';
    import type { GeneratedWorkout, Plan, WorkoutSegment, WorkoutStep } from '@models/plan/plan.model';
    import { exerciseMap, workoutCategoriesSet } from '@/constants/workout.constants';
    import { PUBLIC_APP_ENV } from '$env/static/public';
    import {
        generatePlan as callGeneratePlanProxy,
        isRetryableCode,
        type GeneratePlanErrorCode,
    } from '$lib/gym/generate-plan';
    import { saveSurveyDraft } from '$lib/gym/survey-draft';

    const user: User = $page.data.user;
    const { plansLeft: initialPlansLeft } = user;
    const toastStore = getToastStore();

    type PlanAttemptFailure = { ok: false; code: GeneratePlanErrorCode | 'INVALID_PLAN'; message: string };
    type PlanAttemptResult = { ok: true; plan: Plan } | PlanAttemptFailure;

    onMount(() => {
        if (initialPlansLeft <= 0) planLimitHandler();
    });

    const generatePlan = async (event: CustomEvent<{ formData: SurveyFormModel }>) => {
        const formData = event.detail.formData;
        const proxyAPIurl = PUBLIC_APP_ENV === 'development' ? appConfig.proxyApiUrlDEV : appConfig.proxyApiUrlPROD;
        const retryCount = 2;
        const proxySession: string | null = $page.data.proxySession ?? null;

        loadingState.set(true);

        if (!proxySession) {
            handleExpiredSession(formData);
            return;
        }

        const attempt = await tryGenerateValidPlan(retryCount, proxyAPIurl, proxySession, formData);

        if (!attempt.ok) {
            // An expired session is the one failure the user can actually fix, so it gets its own
            // path: park the survey, then send them back through login instead of to a dead end.
            if (attempt.code === 'INVALID_SESSION') {
                handleExpiredSession(formData);
                return;
            }
            if (attempt.code === 'INVALID_FORM_DATA') {
                // The proxy's schema rejected our payload — retrying sends the same body again.
                console.error('[create-plan] proxy rejected the survey payload:', attempt.message);
            }
            makeToast(toastStore, planFailureMessage(attempt.code), 'variant-filled-error');
            goto('/app');
            loadingState.set(false);
            return;
        }
        const validPlan = attempt.plan;

        // PLANS API
        const plansAPIbody = JSON.stringify({
            plan: validPlan,
        });

        const [plansAPIError, plansAPIresponse] = await to(
            fetch(appConfig.plansApiUrl, {
                method: 'POST',
                body: plansAPIbody,
            }),
        );
        if (plansAPIError || !plansAPIresponse.ok) {
            makeToast(
                toastStore,
                plansAPIError?.message || 'Cannot generate the plan <br> Please try again',
                'variant-filled-error',
            );
            goto('/app');
            loadingState.set(false);
            return;
        }
        const { generatedPlan } = await plansAPIresponse.json();

        loadingState.set(false);
        goto(`/app/gym/my-plans/${generatedPlan.id}`);
    };

    const planLimitHandler = () => {
        const message = 'You have reached the limit of generated plans.';
        if (user.subscriptionTier === 'FREE') {
            makeUpgradeToast(toastStore, message);
        } else {
            makeToast(toastStore, message, 'variant-filled-warning');
        }
        loadingState.set(false);
        goto('/app');
    };

    function handleDraftRestored() {
        makeToast(
            toastStore,
            'We restored your previous answers <br> Step through the survey and generate the plan again',
            'variant-filled-success',
        );
    }

    function handleExpiredSession(formData: SurveyFormModel) {
        saveSurveyDraft(formData);
        makeToast(
            toastStore,
            'Your session expired <br> Please log in again to generate the plan',
            'variant-filled-warning',
        );
        goto('/app/login');
        loadingState.set(false);
    }

    function planFailureMessage(code: GeneratePlanErrorCode | 'INVALID_PLAN'): string {
        if (code === 'INVALID_FORM_DATA') {
            return 'We could not process your survey answers <br> Please try again or contact support';
        }
        if (code === 'PROXY_ERROR') {
            // Network fault, or the proxy/OpenAI itself failing — nothing was wrong with the
            // answers, so say that rather than implying the plan came back and failed validation.
            return 'We could not reach the plan generator <br> Please try again in a moment';
        }
        return 'Failed to generate a valid plan after maximum retries';
    }

    async function tryGenerateValidPlan(
        retries: number,
        url: string,
        session: string,
        formData: SurveyFormModel,
    ): Promise<PlanAttemptResult> {
        let lastFailure: PlanAttemptFailure = {
            ok: false,
            code: 'PROXY_ERROR',
            message: 'Plan generation was not attempted',
        };

        for (let i = 0; i < retries; i++) {
            const result = await callGeneratePlanProxy(url, session, formData);

            if (!result.ok) {
                // A rejected session or a rejected payload returns the same answer every time —
                // burning the retries on them only delays the message the user needs.
                if (!isRetryableCode(result.code)) return result;
                lastFailure = result;
                continue;
            }

            const improvedPlan = correctPlan(result.plan);
            if (isValidPlan(improvedPlan)) {
                return { ok: true, plan: improvedPlan };
            }
            lastFailure = { ok: false, code: 'INVALID_PLAN', message: 'Generated plan failed validation' };
        }

        return lastFailure;
    }

    function correctPlan(plan: Plan): Plan {
        const isPassiveStep = (step: WorkoutStep): boolean =>
            step.stepType.stepTypeId === 5 || step.stepType.stepTypeId === 4 || step.stepType.stepTypeId === 2;

        const categoryCorrect = (step: WorkoutStep): boolean => {
            if (!step.category) return false;
            return workoutCategoriesSet.has(step.category);
        };

        const exerciseNameCorrect = (step: WorkoutStep): boolean => {
            if (!step.exerciseName || !step.category) return false;
            const exercises = exerciseMap.get(step.category);
            return !!exercises && exercises.has(step.exerciseName);
        };

        // Ensure if category and exerciseName are null if stepType is cooldown, rest or recovery
        plan.workouts.forEach((workout: GeneratedWorkout) => {
            workout.workoutSegments.forEach((segment: WorkoutSegment) => {
                segment.workoutSteps.forEach((step: WorkoutStep) => {
                    if (isPassiveStep(step) && (step.category || step.exerciseName)) {
                        step.category = null;
                        step.exerciseName = null;
                    }
                    if (!isPassiveStep(step) && categoryCorrect(step) && !exerciseNameCorrect(step)) {
                        step.exerciseName = exerciseMap.get(step.category!)?.values().next().value || null;
                    }
                });
            });
        });
        return plan;
    }

    function isValidPlan(plan: Plan): boolean {
        return plan.workouts.every((workout: GeneratedWorkout) => {
            return workout.workoutSegments.every((segment: WorkoutSegment) => {
                return segment.workoutSteps.every((step: WorkoutStep) => isValidWorkoutStep(step));
            });
        });
    }

    function isValidWorkoutStep(step: WorkoutStep): boolean {
        if (!step.stepType || typeof step.stepType.stepTypeId !== 'number') return false;

        // for cooldown, rest and recovery steps omit category and exercise validation
        if (step.stepType.stepTypeId === 5 || step.stepType.stepTypeId === 4 || step.stepType.stepTypeId === 2) {
            return true;
            // for repeat step validate each nested step
        } else if (step.stepType.stepTypeId === 6) {
            return (
                Array.isArray(step.workoutSteps) &&
                step.workoutSteps?.every((repeatStep: WorkoutStep) => isValidWorkoutStep(repeatStep))
            );
        } else {
            if (!step.category || !step.exerciseName) {
                // console.log('Invalid step:', step);
                return false;
            }
            return !!exerciseMap.get(step.category)?.has(step.exerciseName);
        }
    }
</script>

{#if $loadingState}
    <Loader />
{:else}
    <SurveyForm on:complete={generatePlan} on:restored={handleDraftRestored} />
{/if}
