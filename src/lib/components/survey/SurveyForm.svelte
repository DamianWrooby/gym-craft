<script lang="ts">
    import { ArrowRightIcon, ArrowLeftIcon } from 'svelte-feather-icons';
    import SurveyFormStep1 from '@components/survey/step-1/SurveyFormStep1.svelte';
    import SurveyFormStep2 from '@components/survey/step-2/SurveyFormStep2.svelte';
    import SurveyFormStep3 from '@components/survey/step-3/SurveyFormStep3.svelte';
    import SurveyFormStep4 from '@components/survey/step-4/SurveyFormStep4.svelte';
    import type { SurveyFormModel } from '@/models/survey/survey-form.model';

    let steps = ['PersonalInfo', 'Goals', 'Experience', 'Schedule', 'FitnessLevel'],
        currentActive = 1;

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
    };

    const handleProgress = (stepIncrement: number) => {
        if (stepIncrement === 1) {
            currentActive++;
        } else {
            currentActive--;
        }
    };
</script>

<div class="h-full flex flex-col items-center justify-center">
    <h1 class="h1 text-center text-xl py-10">
        Fill out the survey and generate a training plan tailored to you
    </h1>
    <div class="card md:w-[50%] p-16 mb-8">
        {#if currentActive === 1}
            <SurveyFormStep1 bind:data={formData.personalInfo} />
        {:else if currentActive === 2}
            <SurveyFormStep2 bind:data={formData.goals} />
        {:else if currentActive === 3}
            <SurveyFormStep3 bind:data={formData.experience} />
        {:else if currentActive === 4}
            <SurveyFormStep4 bind:data={formData.lifestyle} />
        {/if}
        <footer class="card-footer flex justify-between">
            {#if currentActive !== 1}
                <button
                    class="btn variant-filled-secondary group"
                    type="button"
                    on:click={() => handleProgress(-1)}>
                    <ArrowLeftIcon class="group-hover:animate-pulse" />
                    <span>Previous</span>
                </button>
            {/if}
            {#if currentActive !== steps.length}
                <button
                    class="btn variant-filled-secondary group"
                    type="button"
                    on:click={() => handleProgress(+1)}>
                    <span>Next</span>
                    <ArrowRightIcon class="group-hover:animate-pulse" />
                </button>
            {/if}
        </footer>
    </div>
</div>
