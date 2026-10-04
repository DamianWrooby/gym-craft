<script lang="ts">
    import { page } from '$app/stores';
    import { loadingState } from '@/stores';
    import { onMount } from 'svelte';
    import SurveyForm from '@components/survey/SurveyForm.svelte';
    import Loader from '@components/loading/loader/Loader.svelte';
    import { makeToast, makeUpgradeToast } from '$lib/utils/toasts';
    import { getToastStore } from '@skeletonlabs/skeleton';
    import { appConfig } from '@/constants/app.constants';
    import type { SurveyFormModel } from '@/models/survey/survey-form.model';
    import type { User } from '@/models/user/user.model';
    import { goto } from '$app/navigation';
    import { PUBLIC_APP_ENV } from '$env/static/public';
    import { startPlanJob } from '$lib/gym/plan-job';
    import { saveSurveyDraft } from '$lib/gym/survey-draft';

    const user: User = $page.data.user;
    const { plansLeft: initialPlansLeft } = user;
    const toastStore = getToastStore();

    onMount(() => {
        if (initialPlansLeft <= 0) planLimitHandler();
    });

    const generatePlan = (event: CustomEvent<{ formData: SurveyFormModel }>) => {
        const formData = event.detail.formData;
        const proxyAPIurl = PUBLIC_APP_ENV === 'development' ? appConfig.proxyApiUrlDEV : appConfig.proxyApiUrlPROD;
        const proxySession: string | null = $page.data.proxySession ?? null;

        if (!proxySession) {
            handleExpiredSession(formData);
            return;
        }

        // Runs in a module-level job, so leaving this page does not cancel it.
        // PlanJobWatcher in the app layout handles the result.
        startPlanJob(proxyAPIurl, proxySession, formData);
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
</script>

{#if $loadingState}
    <Loader />
    <p class="text-center text-sm opacity-75 px-4 pb-8">
        This takes up to a minute. You can keep using GymCraft — we will tell you when the plan is ready.
    </p>
{:else}
    <SurveyForm on:complete={generatePlan} on:restored={handleDraftRestored} />
{/if}
