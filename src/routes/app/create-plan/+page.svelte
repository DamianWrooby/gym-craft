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

    const user: User = $page.data.user;
    const { plansLeft: initialPlansLeft } = user;
    const toastStore = getToastStore();

    onMount(() => {
        if (initialPlansLeft <= 0) planLimitHandler();
    });

    const generatePlan = async (event: CustomEvent<{ formData: SurveyFormModel }>) => {
        loadingState.set(true);

        const formData = event.detail.formData;
        const plansAPIbody = JSON.stringify({
            user,
            formData,
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
        goto(`/app/my-plans/${generatedPlan.id}`)
    };

    const planLimitHandler = () => {
        makeToast(toastStore, 'You have reached the limit of generated plans.', 'variant-filled-warning');
        loadingState.set(false);
        goto('/app');
    };
</script>

{#if $loadingState}
    <Loader />
{:else}
    <SurveyForm on:complete={generatePlan} />
{/if}
