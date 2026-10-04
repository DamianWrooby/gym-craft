<script lang="ts">
    import { onMount } from 'svelte';
    import { page } from '$app/stores';
    import { goto } from '$app/navigation';
    import { getToastStore } from '@skeletonlabs/skeleton';
    import { makePlanReadyToast, makeToast } from '$lib/utils/toasts';
    import { onPlanJobFinished, planFailureMessage, type PlanJobOutcome } from '$lib/gym/plan-job';
    import { saveSurveyDraft } from '$lib/gym/survey-draft';

    const CREATE_PLAN_PATH = '/app/gym/create-plan';
    const toastStore = getToastStore();

    onMount(() => onPlanJobFinished(handle));

    function handle(outcome: PlanJobOutcome) {
        const onCreatePlan = $page.url.pathname === CREATE_PLAN_PATH;

        if (outcome.status === 'done') {
            const url = `/app/gym/my-plans/${outcome.planId}`;
            if (onCreatePlan) goto(url);
            else makePlanReadyToast(toastStore, url);
            return;
        }

        if (outcome.code === 'INVALID_SESSION') {
            // The one failure the user can fix: park the survey, then send them through login.
            saveSurveyDraft(outcome.formData);
            makeToast(
                toastStore,
                'Your session expired <br> Please log in again to generate the plan',
                'variant-filled-warning',
            );
            goto('/app/login');
            return;
        }
        if (outcome.code === 'INVALID_FORM_DATA') {
            // The proxy's schema rejected our payload — retrying sends the same body again.
            console.error('[plan-job] proxy rejected the survey payload:', outcome.message);
        }
        makeToast(toastStore, planFailureMessage(outcome.code), 'variant-filled-error');
        if (onCreatePlan) goto('/app');
    }
</script>
