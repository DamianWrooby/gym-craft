<script lang="ts">
    import { page } from '$app/stores';
    import { loadingState } from '@/stores';
    import SurveyForm from '@components/survey/SurveyForm.svelte';
    import GeneratedPlan from '@components/generated-plan/GeneratedPlan.svelte';
    import Loader from '@components/loading/loader/Loader.svelte';
    import { makeToast } from '$lib/utils/toasts';
    import { getToastStore } from '@skeletonlabs/skeleton';

    import { appConfig } from '@/constants/app.constants';
    import { generateAPIMessages } from '$lib/utils/generate-messages';
    import { planMock } from './planMock';
    import type { Plan } from '@prisma/client';
    import type { SurveyFormModel } from '@/models/survey/survey-form.model';
    import type { User } from '@/models/user/user.model';

    const user: User = $page.data.user;
    const toastStore = getToastStore();

    let generatedPlan: string;
    let generatedPlansNumber: number;

    const generatePlan = async (event: CustomEvent<{ formData: SurveyFormModel }>) => {
        const formData = event.detail.formData;
        loadingState.set(true);

        const messages = generateAPIMessages(formData);
        const body = JSON.stringify({ user, messages });

        try {
            const response = await fetch(appConfig.plansApiUrl, {
                method: 'POST',
                body,
            });
            const data: { generatedPlan: Plan; generatedPlansNumber: number } = await response.json();
            generatedPlan = data.generatedPlan.description;
            generatedPlansNumber = data.generatedPlansNumber;
        } catch (error) {
            makeToast(toastStore, error as string, 'variant-filled-error');
        }

        loadingState.set(false);
    };
</script>

{#if $loadingState}
    <Loader />
{:else if generatedPlan}
    <GeneratedPlan plan={generatedPlan} {generatedPlansNumber} />
{:else}
    <SurveyForm on:complete={generatePlan} />
{/if}
