<script lang="ts">
    import { page } from '$app/stores';
    import { loadingState } from '@/stores';
    import SurveyForm from '@components/survey/SurveyForm.svelte';
    import Spinner from '$lib/components/loading/spinner/Spinner.svelte';
    import TextLoader from '$lib/components/loading/text-loader/TextLoader.svelte';

    import { appConfig } from '@/constants/app.constants';
    import { generateAPIMessages } from '$lib/utils/generate-messages';
    import type { Plan } from '@prisma/client';
    import type { SurveyFormModel } from '@/models/survey/survey-form.model';

    const user = $page.data.user;

    let generatedPlan: string;

    const generatePlan = async (event: CustomEvent<{ formData: SurveyFormModel }>) => {
        const formData = event.detail.formData;
        loadingState.set(true);

        // const messages = generateAPIMessages(formData);
        // const body = JSON.stringify({ user, messages });

        // const response = await fetch(appConfig.internalApiUrl, {
        //     method: 'POST',
        //     body,
        // });
        // const data: Plan = await response.json();
        // generatedPlan = data.description;
        setTimeout(() => {
            generatedPlan = 'test data';
            loadingState.set(false);
        }, 3000);
    };
</script>

{#if $loadingState}
    <TextLoader />
    <Spinner size={10} />
{:else if generatedPlan}
    <div class="h-full flex flex-col items-center justify-center">
        <div class="card md:w-[50%] p-16 mb-8">
            <h2 class="h2 text-center text-xl py-10">Generated plan:</h2>
            {@html generatedPlan}
        </div>
    </div>
{:else}
    <SurveyForm on:complete={generatePlan} />
{/if}
