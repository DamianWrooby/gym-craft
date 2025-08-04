<script lang="ts">
    import { page } from '$app/stores';
    import { loadingState } from '@/stores';
    import { onMount } from 'svelte';
    import { to } from 'await-to-js';
    import SurveyForm from '@components/survey/SurveyForm.svelte';
    import Loader from '@components/loading/loader/Loader.svelte';
    import { makeToast } from '$lib/utils/toasts';
    import { getToastStore } from '@skeletonlabs/skeleton';
    import { appConfig } from '@/constants/app.constants';
    import type { SurveyFormModel } from '@/models/survey/survey-form.model';
    import type { User } from '@/models/user/user.model';
    import { goto } from '$app/navigation';
    import type { GeneratedWorkout, Plan, WorkoutSegment, WorkoutStep } from '@models/plan/plan.model';
    import { exerciseMap, workoutCategoriesSet } from '@/constants/workout.constants';
    import { PUBLIC_APP_ENV } from '$env/static/public';

    const user: User = $page.data.user;
    const { plansLeft: initialPlansLeft } = user;
    const toastStore = getToastStore();

    onMount(() => {
        if (initialPlansLeft <= 0) planLimitHandler();
    });

    const generatePlan = async (event: CustomEvent<{ formData: SurveyFormModel }>) => {
        const formData = event.detail.formData;
        const proxyAPIurl = PUBLIC_APP_ENV === 'development' ? appConfig.proxyApiUrlDEV : appConfig.proxyApiUrlPROD;
        const retryCount = 2;

        loadingState.set(true);

        // PREPARE PROXY SERVER RESPONSE
        const requestBody = JSON.stringify({
            session: user.session,
            formData,
        });

        const validPlan = await tryGenerateValidPlan(retryCount, proxyAPIurl, requestBody);

        if (!validPlan) {
            makeToast(toastStore, 'Failed to generate a valid plan after maximum retries', 'variant-filled-error');
            goto('/app');
            loadingState.set(false);
            return;
        }

        // PLANS API
        const plansAPIbody = JSON.stringify({
            session: user.session,
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
        const { generatedPlan, _ } = await plansAPIresponse?.json();

        loadingState.set(false);
        goto(`/app/my-plans/${generatedPlan.id}`);
    };

    const planLimitHandler = () => {
        makeToast(toastStore, 'You have reached the limit of generated plans.', 'variant-filled-warning');
        loadingState.set(false);
        goto('/app');
    };

    async function tryGenerateValidPlan(retries: number, url: string, body: string): Promise<Plan | null> {
        for (let i = 0; i < retries; i++) {
            const plan = await fetchPlan(url, body);
            if (!plan) {
                // console.log(`Failed to generate plan - retrying (${i + 1}/${retries})`);
                continue;
            }

            const improvedPlan = correctPlan(plan);
            const isValid = isValidPlan(improvedPlan);

            if (isValid) {
                // console.log('Generated plan is valid');
                return improvedPlan;
            } else {
                // console.log(`Generated plan is not valid - retrying (${i + 1}/${retries})`);
                continue;
            }
        }
        return null;
    }

    async function fetchPlan(url: string, body: string): Promise<Plan | null> {
        const [proxyError, proxyResponse] = await fetchPlanFromProxyServer(url, body);
        if (proxyError || !proxyResponse?.ok) return null;
        const generatedPlan: Plan = await proxyResponse?.json();

        return generatedPlan;
    }

    async function fetchPlanFromProxyServer(
        url: string,
        body: string,
    ): Promise<[null, Response] | [Error | null, undefined]> {
        return await to(
            fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: body,
            }),
        );
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
    <SurveyForm on:complete={generatePlan} />
{/if}
