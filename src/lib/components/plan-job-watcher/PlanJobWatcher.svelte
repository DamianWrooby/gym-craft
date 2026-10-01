<script lang="ts">
    import { page } from '$app/stores';
    import { goto } from '$app/navigation';
    import { getToastStore } from '@skeletonlabs/skeleton';
    import { makePlanReadyToast, makeToast } from '$lib/utils/toasts';
    import { planJob, planFailureMessage, resetPlanJob, type PlanJobState } from '$lib/gym/plan-job';
    import { saveSurveyDraft } from '$lib/gym/survey-draft';

    const CREATE_PLAN_PATH = '/app/gym/create-plan';
    const toastStore = getToastStore();

    $: handle($planJob);

    function handle(state: PlanJobState) {
        if (state.status === 'done') {
            const url = `/app/gym/my-plans/${state.planId}`;
            resetPlanJob();
            if ($page.url.pathname === CREATE_PLAN_PATH) {
                goto(url);
            } else {
                makePlanReadyToast(toastStore, url);
            }
        } else if (state.status === 'failed') {
            resetPlanJob();
            if (state.code === 'INVALID_SESSION') {
                // The one failure the user can fix: park the survey, then send them through login.
                saveSurveyDraft(state.formData);
                makeToast(
                    toastStore,
                    'Your session expired <br> Please log in again to generate the plan',
                    'variant-filled-warning',
                );
                goto('/app/login');
                return;
            }
            if (state.code === 'INVALID_FORM_DATA') {
                // The proxy's schema rejected our payload — retrying sends the same body again.
                console.error('[plan-job] proxy rejected the survey payload:', state.message);
            }
            makeToast(toastStore, planFailureMessage(state.code), 'variant-filled-error');
            if ($page.url.pathname === CREATE_PLAN_PATH) goto('/app');
        }
    }
</script>
