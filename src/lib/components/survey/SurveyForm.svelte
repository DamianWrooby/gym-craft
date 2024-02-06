<script lang="ts">
    import { page } from '$app/stores';
    import { createEventDispatcher, onMount } from 'svelte';
    import { ArrowRightIcon, ArrowLeftIcon, ChevronsRightIcon } from 'svelte-feather-icons';
    import { getModalStore } from '@skeletonlabs/skeleton';
    import type { ModalSettings } from '@skeletonlabs/skeleton';
    import type { User } from '@/models/user/user.model';

    import SurveyFormStep1 from '@components/survey/step-1/SurveyFormStep1.svelte';
    import SurveyFormStep2 from '@components/survey/step-2/SurveyFormStep2.svelte';
    import SurveyFormStep3 from '@components/survey/step-3/SurveyFormStep3.svelte';
    import SurveyFormStep4 from '@components/survey/step-4/SurveyFormStep4.svelte';
    import SurveyFormStep5 from '@components/survey/step-5/SurveyFormStep5.svelte';
    import SurveyFormStep6 from '@components/survey/step-6/SurveyFormStep6.svelte';
    import SurveyFormStep7 from '@components/survey/step-7/SurveyFormStep7.svelte';
    import ProgressBar from '@components/progress-bar/ProgressBar.svelte';
    import { loadingState } from '@/stores';
    import type { SurveyFormModel } from '@/models/survey/survey-form.model';

    const user: User = $page.data.user;
    const dispatch = createEventDispatcher<{ complete: { formData: SurveyFormModel } }>();
    const modalStore = getModalStore();

    let currentActive = 1;
    let formElement: HTMLFormElement;
    let formValidation = false;

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

    let stepsNumber = Object.keys(formData).length;

    onMount(() => {
        openInfoModal();
    });

    const handleNext = (stepIncrement: number) => {
        const setCurrentActive = () => {
            stepIncrement === 1 ? currentActive++ : currentActive--;
        };

        if (formValidation) {
            formElement.reportValidity() && setCurrentActive();
        } else {
            setCurrentActive();
        }
    };

    const openInfoModal = () => {
        const modal: ModalSettings = {
            type: 'alert',
            title: 'Information',
            body: 'With any physical activity, safety and technique of the exercises performed are crucial. If you are inexperienced, you should enlist the help of a professional personal trainer who will gradually introduce you to the world of sports, minimizing the risk of injury. <br><br> This app is not a substitute for a training plan prepared by a professional trainer, and is only an auxiliary tool designed to support the work of a personal trainer.',
            buttonTextCancel: 'Proceed',
        };
        modalStore.trigger(modal);
    };

    const onGeneratePlanClick = () => {
        dispatch('complete', { formData });
    };
</script>

<div class="h-full flex flex-col items-center justify-center">
    <h1 class="h1 text-center text-xl py-10 px-4">
        Fill out the survey and generate a training plan tailored to your goals
    </h1>

    <form
        bind:this={formElement}
        class="card w-full md:w-[50%] p-6 md:p-16 mb-8 relative overflow-hidden">
        <ProgressBar max={stepsNumber} curr={currentActive} duration={500} />
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
        <footer class="card-footer flex">
            <div class="w-1/2 flex justify-start">
                {#if currentActive !== 1}
                    <button
                        class="btn variant-filled-secondary group"
                        type="button"
                        disabled={$loadingState}
                        on:click={() => handleNext(-1)}>
                        <ArrowLeftIcon class="group-hover:animate-pulse" />
                        <span>Previous</span>
                    </button>
                {/if}
            </div>
            <div class="w-1/2 flex justify-end">
                {#if currentActive !== stepsNumber}
                    <button
                        class="btn variant-filled-secondary group"
                        type="button"
                        on:click={() => handleNext(+1)}>
                        <span>Next</span>
                        <ArrowRightIcon class="group-hover:animate-pulse" />
                    </button>
                {:else}
                    <button
                        class="btn variant-filled-primary group"
                        type="button"
                        disabled={user.generatedPlansNumber > 10 || $loadingState}
                        on:click={() => onGeneratePlanClick()}>
                        <span>Generate plan</span>
                        <ChevronsRightIcon class="group-hover:animate-pulse" />
                    </button>
                {/if}
            </div>
        </footer>
    </form>
</div>
