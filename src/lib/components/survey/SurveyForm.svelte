<script lang="ts">
    import { page } from '$app/stores';
    import { ArrowRightIcon, ArrowLeftIcon, ChevronsRightIcon } from 'svelte-feather-icons';

    import SurveyFormStep1 from '@components/survey/step-1/SurveyFormStep1.svelte';
    import SurveyFormStep2 from '@components/survey/step-2/SurveyFormStep2.svelte';
    import SurveyFormStep3 from '@components/survey/step-3/SurveyFormStep3.svelte';
    import SurveyFormStep4 from '@components/survey/step-4/SurveyFormStep4.svelte';
    import SurveyFormStep5 from '@components/survey/step-5/SurveyFormStep5.svelte';
    import SurveyFormStep6 from '@components/survey/step-6/SurveyFormStep6.svelte';
    import SurveyFormStep7 from '@components/survey/step-7/SurveyFormStep7.svelte';

    import { appConfig } from '@/constants/app.constants';
    import { generateAPIMessages } from '$lib/utils/generate-messages';
    import { loadingState } from '@/stores';
    import type { SurveyFormModel } from '@/models/survey/survey-form.model';
    import type { Plan } from '@prisma/client';

    const user = $page.data.user;
    let currentActive = 1;
    let formElement: HTMLFormElement;
    let formValidation = false;
    let generatedPlan: string;

    let formData: SurveyFormModel = {
        personalInfo: {
            sex: '',
            age: 0,
            height: 0,
            weight: 0,
            medicalConditions: '',
        },
        goals: {
            mainGoals: {
                'general-fitness-and-health': false,
                'lose-weight': false,
                'gain-muscle': false,
                'body-definition': false,
                'athletic-performance': false,
                'stress-reduction': false,
                other: false,
            },
            otherGoalsDescription: '',
        },
        experience: {
            activityLevel: '',
            activityHistory: '',
            enjoyedExercises: '',
            dislikedExercises: '',
        },
        lifestyle: {
            job: '',
            hourCapacity: '',
            timePreferences: '',
            trainingDays: {
                monday: false,
                tuesday: false,
                wednesday: false,
                thursday: false,
                friday: false,
                saturday: false,
                sunday: false,
            },
        },
        fitnessLevel: {
            fitnessLevel: 0,
            currentActivities: '',
            physicalLimitations: '',
        },
        equipment: {
            freeWeights: false,
            trainingMachines: false,
            treadmill: false,
            rowingMachine: false,
            stationaryBike: false,
            elliptical: false,
            stairMaster: false,
            resistanceBands: false,
            trx: false,
            calisthenics: false,
            mtbBike: false,
            roadBike: false,
        },
        additionalInfo: {
            cycleLength: 4,
        },
    };

    let steps = Object.keys(formData).length;

    const handleProgress = (stepIncrement: number) => {
        const setCurrentActive = () => {
            stepIncrement === 1 ? currentActive++ : currentActive--;
        };

        if (formValidation) {
            formElement.reportValidity() && setCurrentActive();
        } else {
            setCurrentActive();
        }
    };

    const generatePlan = async () => {
        loadingState.set(true);

        const messages = generateAPIMessages(formData);
        const body = JSON.stringify({ user, messages });

        const response = await fetch(appConfig.internalApiUrl, {
            method: 'POST',
            body,
        });
        const data: Plan = await response.json();
        generatedPlan = data.description;

        loadingState.set(false);
    };
    // TODO: Add stepper
</script>

<div class="h-full flex flex-col items-center justify-center">
    <h1 class="h1 text-center text-xl py-10">
        Fill out the survey and generate a training plan tailored to you
    </h1>
    <form bind:this={formElement} class="card md:w-[50%] p-16 mb-8">
        {#if currentActive === 1}
            <SurveyFormStep1 bind:data={formData.personalInfo} />
        {:else if currentActive === 2}
            <SurveyFormStep2 bind:data={formData.goals} />
        {:else if currentActive === 3}
            <SurveyFormStep3 bind:data={formData.experience} />
        {:else if currentActive === 4}
            <SurveyFormStep4 bind:data={formData.lifestyle} />
        {:else if currentActive === 5}
            <SurveyFormStep5 bind:data={formData.fitnessLevel} />
        {:else if currentActive === 6}
            <SurveyFormStep6 bind:data={formData.equipment} />
        {:else if currentActive === 7}
            <SurveyFormStep7 bind:data={formData.additionalInfo} />
        {/if}
        <footer class="card-footer flex justify-between">
            {#if currentActive !== 1}
                <button
                    class="btn variant-filled-secondary group"
                    type="button"
                    disabled={$loadingState}
                    on:click={() => handleProgress(-1)}>
                    <ArrowLeftIcon class="group-hover:animate-pulse" />
                    <span>Previous</span>
                </button>
            {/if}
            {#if currentActive !== steps}
                <button
                    class="btn variant-filled-secondary group"
                    type="button"
                    on:click={() => handleProgress(+1)}>
                    <span>Next</span>
                    <ArrowRightIcon class="group-hover:animate-pulse" />
                </button>
            {:else}
                <button
                    class="btn variant-filled-primary group"
                    type="button"
                    disabled={user.generatedPlans > 10 || $loadingState}
                    on:click={async () => await generatePlan()}>
                    {#if $loadingState}
                        <svg
                            aria-hidden="true"
                            role="status"
                            class="inline w-4 h-4 me-3 text-white animate-spin"
                            viewBox="0 0 100 101"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg">
                            <path
                                d="M100 50.5908C100 78.2051 77.6142 100.591 50 100.591C22.3858 100.591 0 78.2051 0 50.5908C0 22.9766 22.3858 0.59082 50 0.59082C77.6142 0.59082 100 22.9766 100 50.5908ZM9.08144 50.5908C9.08144 73.1895 27.4013 91.5094 50 91.5094C72.5987 91.5094 90.9186 73.1895 90.9186 50.5908C90.9186 27.9921 72.5987 9.67226 50 9.67226C27.4013 9.67226 9.08144 27.9921 9.08144 50.5908Z"
                                fill="#E5E7EB" />
                            <path
                                d="M93.9676 39.0409C96.393 38.4038 97.8624 35.9116 97.0079 33.5539C95.2932 28.8227 92.871 24.3692 89.8167 20.348C85.8452 15.1192 80.8826 10.7238 75.2124 7.41289C69.5422 4.10194 63.2754 1.94025 56.7698 1.05124C51.7666 0.367541 46.6976 0.446843 41.7345 1.27873C39.2613 1.69328 37.813 4.19778 38.4501 6.62326C39.0873 9.04874 41.5694 10.4717 44.0505 10.1071C47.8511 9.54855 51.7191 9.52689 55.5402 10.0491C60.8642 10.7766 65.9928 12.5457 70.6331 15.2552C75.2735 17.9648 79.3347 21.5619 82.5849 25.841C84.9175 28.9121 86.7997 32.2913 88.1811 35.8758C89.083 38.2158 91.5421 39.6781 93.9676 39.0409Z"
                                fill="currentColor" />
                        </svg>
                        Generating plan...
                    {:else}
                        <span>Generate plan</span>
                        <ChevronsRightIcon class="group-hover:animate-pulse" />
                    {/if}
                </button>
            {/if}
        </footer>
    </form>
    {#if generatedPlan}
        <div class="card md:w-[50%] p-16 mb-8">
            <h2 class="h2 text-center text-xl py-10">Generated plan:</h2>
            {@html generatedPlan}
        </div>
    {/if}
</div>
