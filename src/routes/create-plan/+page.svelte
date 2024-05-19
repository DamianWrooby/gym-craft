<script lang="ts">
    // TODO: redirect user directly to my-plans after generating a plan
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
    import { goto } from '$app/navigation';
    import { PUBLIC_APP_ENV } from '$env/static/public';

    const user: User = $page.data.user;
    const generatedPlansNumber: number = user.generatedPlansNumber;
    const toastStore = getToastStore();

    let planContent: string;
    let plansLeft: number;

    const generatePlan = async (event: CustomEvent<{ formData: SurveyFormModel }>) => {
        loadingState.set(true);

        // Check if the user has reached the limit of generated plans
        try {
            const generalPlansInfoResponse = await fetch(appConfig.plansApiUrl, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                },
            });
            const generalPlansInfo = await generalPlansInfoResponse.json();
            if (generatedPlansNumber >= generalPlansInfo.generalPlanLimit) {
                planLimitHandler();
            }
        } catch (error) {
            planLimitHandler();
        }

        // Prepare the request body for the proxy server
        const formData = event.detail.formData;
        const messages = generateAPIMessages(formData);
        const proxyServerBody = JSON.stringify({
            user,
            openAIrequestBody: JSON.stringify({
                model: appConfig.model,
                seed: appConfig.openAIcompletionSeed,
                temperature: appConfig.openAIcompletionTemperature,
                messages,
            }),
        });

        // Proxy server API call
        const proxyAPIurl =
            PUBLIC_APP_ENV === 'development' ? appConfig.proxyApiUrlDEV : appConfig.proxyApiUrlPROD;
        try {
            const proxyResponse = await fetch(proxyAPIurl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: proxyServerBody,
            });
            const chatCompletion: string = await proxyResponse.json();

            // Plans API call to save the generated plan in DB and updated generated plans number
            const plansAPIbody = JSON.stringify({ user, planContent: chatCompletion });
            const plansAPIresponse = await fetch(appConfig.plansApiUrl, {
                method: 'POST',
                body: plansAPIbody,
            });
            const { generatedPlan, plansLeft: plansLeftNumber } = await plansAPIresponse.json();
            planContent = generatedPlan.description;
            plansLeft = plansLeftNumber;
        } catch (error) {
            console.error(error);
            makeToast(toastStore, error as string, 'variant-filled-error');
        }
        loadingState.set(false);
        // setTimeout(() => {
        //     generatedPlan = planMock;
        //     plansLeft = 5;
        //     loadingState.set(false);
        // }, 5000);
    };

    const planLimitHandler = () => {
        makeToast(toastStore, 'You have reached the limit of generated plans.', 'variant-filled-warning');
        loadingState.set(false);
        goto('/');
    };
</script>

{#if $loadingState}
    <Loader />
{:else if planContent}
    <GeneratedPlan {planContent} {plansLeft} />
{:else}
    <SurveyForm on:complete={generatePlan} />
{/if}
