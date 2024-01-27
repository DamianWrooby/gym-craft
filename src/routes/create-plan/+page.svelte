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
    console.log(user);

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
            generatedPlan = 'Day 1: Upper Body Strength, Bench Press: 4 sets x 8-10 repsBent Over Rows: 3 sets x 10 repsOverhead Shoulder Press: 3 sets x 12 repsBicep Curls: 3 sets x 12 repsTricep Dips: 3 sets x 12 repsDay 2: Cardiovascular Exercise30 minutes of moderate-intensity cardio (e.g., running, cycling, elliptical)Day 3: Lower Body StrengthSquats: 4 sets x 10 repsDeadlifts: 3 sets x 8 repsLunges: 3 sets x 12 reps (each leg)Leg Press: 3 sets x 12 repsCalf Raises: 3 sets x 15 repsDay 4: Rest or Active RecoveryTake a day off from intense training or engage in light activities like walking, yoga, or stretchingDay 5: Cardiovascular Exercis30 minutes of high-intensity interval training (HIIT) or any other preferred cardio activityDay 6: Full Body Workout  Pull-ups or Lat Pulldowns: 3 sets x 10 rep Push-ups or Chest Flyes: 3 sets x 12 rep Leg Extensions: 3 sets x 12 rep Plank: 3 sets, hold for 60 seconds eac Russian Twists: 3 sets x 20 reps (for core Day 7: Res Allow your body to recover completely Remember to adjust the weights and intensity based on your fitness level and gradually progress over time. Additionally, proper warm-u and cool-down sessions are essential before and after each workout to prevent injuries and enhance flexibility. Its always a good ide to consult with a fitness professional or your healthcare provider before starting a new workout routine, especially if you have an existing health concerns or conditions.Day 1: Upper Body Strength, Bench Press: 4 sets x 8-10 repsBent Over Rows: 3 sets x 10 repsOverhead Shoulder Press: 3 sets x 12 repsBicep Curls: 3 sets x 12 repsTricep Dips: 3 sets x 12 repsDay 2: Cardiovascular Exercise30 minutes of moderate-intensity cardio (e.g., running, cycling, elliptical)Day 3: Lower Body StrengthSquats: 4 sets x 10 repsDeadlifts: 3 sets x 8 repsLunges: 3 sets x 12 reps (each leg)Leg Press: 3 sets x 12 repsCalf Raises: 3 sets x 15 repsDay 4: Rest or Active RecoveryTake a day off from intense training or engage in light activities like walking, yoga, or stretchingDay 5: Cardiovascular Exercis30 minutes of high-intensity interval training (HIIT) or any other preferred cardio activityDay 6: Full Body Workout  Pull-ups or Lat Pulldowns: 3 sets x 10 rep Push-ups or Chest Flyes: 3 sets x 12 rep Leg Extensions: 3 sets x 12 rep Plank: 3 sets, hold for 60 seconds eac Russian Twists: 3 sets x 20 reps (for core Day 7: Res Allow your body to recover completely Remember to adjust the weights and intensity based on your fitness level and gradually progress over time. Additionally, proper warm-u and cool-down sessions are essential before and after each workout to prevent injuries and enhance flexibility. Its always a good ide to consult with a fitness professional or your healthcare provider before starting a new workout routine, especially if you have an existing health concerns or conditions.Day 1: Upper Body Strength, Bench Press: 4 sets x 8-10 repsBent Over Rows: 3 sets x 10 repsOverhead Shoulder Press: 3 sets x 12 repsBicep Curls: 3 sets x 12 repsTricep Dips: 3 sets x 12 repsDay 2: Cardiovascular Exercise30 minutes of moderate-intensity cardio (e.g., running, cycling, elliptical)Day 3: Lower Body StrengthSquats: 4 sets x 10 repsDeadlifts: 3 sets x 8 repsLunges: 3 sets x 12 reps (each leg)Leg Press: 3 sets x 12 repsCalf Raises: 3 sets x 15 repsDay 4: Rest or Active RecoveryTake a day off from intense training or engage in light activities like walking, yoga, or stretchingDay 5: Cardiovascular Exercis30 minutes of high-intensity interval training (HIIT) or any other preferred cardio activityDay 6: Full Body Workout  Pull-ups or Lat Pulldowns: 3 sets x 10 rep Push-ups or Chest Flyes: 3 sets x 12 rep Leg Extensions: 3 sets x 12 rep Plank: 3 sets, hold for 60 seconds eac Russian Twists: 3 sets x 20 reps (for core Day 7: Res Allow your body to recover completely Remember to adjust the weights and intensity based on your fitness level and gradually progress over time. Additionally, proper warm-u and cool-down sessions are essential before and after each workout to prevent injuries and enhance flexibility. Its always a good ide to consult with a fitness professional or your healthcare provider before starting a new workout routine, especially if you have an existing health concerns or conditions.Day 1: Upper Body Strength, Bench Press: 4 sets x 8-10 repsBent Over Rows: 3 sets x 10 repsOverhead Shoulder Press: 3 sets x 12 repsBicep Curls: 3 sets x 12 repsTricep Dips: 3 sets x 12 repsDay 2: Cardiovascular Exercise30 minutes of moderate-intensity cardio (e.g., running, cycling, elliptical)Day 3: Lower Body StrengthSquats: 4 sets x 10 repsDeadlifts: 3 sets x 8 repsLunges: 3 sets x 12 reps (each leg)Leg Press: 3 sets x 12 repsCalf Raises: 3 sets x 15 repsDay 4: Rest or Active RecoveryTake a day off from intense training or engage in light activities like walking, yoga, or stretchingDay 5: Cardiovascular Exercis30 minutes of high-intensity interval training (HIIT) or any other preferred cardio activityDay 6: Full Body Workout  Pull-ups or Lat Pulldowns: 3 sets x 10 rep Push-ups or Chest Flyes: 3 sets x 12 rep Leg Extensions: 3 sets x 12 rep Plank: 3 sets, hold for 60 seconds eac Russian Twists: 3 sets x 20 reps (for core Day 7: Res Allow your body to recover completely Remember to adjust the weights and intensity based on your fitness level and gradually progress over time. Additionally, proper warm-u and cool-down sessions are essential before and after each workout to prevent injuries and enhance flexibility. Its always a good ide to consult with a fitness professional or your healthcare provider before starting a new workout routine, especially if you have an existing health concerns or conditions.Day 1: Upper Body Strength, Bench Press: 4 sets x 8-10 repsBent Over Rows: 3 sets x 10 repsOverhead Shoulder Press: 3 sets x 12 repsBicep Curls: 3 sets x 12 repsTricep Dips: 3 sets x 12 repsDay 2: Cardiovascular Exercise30 minutes of moderate-intensity cardio (e.g., running, cycling, elliptical)Day 3: Lower Body StrengthSquats: 4 sets x 10 repsDeadlifts: 3 sets x 8 repsLunges: 3 sets x 12 reps (each leg)Leg Press: 3 sets x 12 repsCalf Raises: 3 sets x 15 repsDay 4: Rest or Active RecoveryTake a day off from intense training or engage in light activities like walking, yoga, or stretchingDay 5: Cardiovascular Exercis30 minutes of high-intensity interval training (HIIT) or any other preferred cardio activityDay 6: Full Body Workout  Pull-ups or Lat Pulldowns: 3 sets x 10 rep Push-ups or Chest Flyes: 3 sets x 12 rep Leg Extensions: 3 sets x 12 rep Plank: 3 sets, hold for 60 seconds eac Russian Twists: 3 sets x 20 reps (for core Day 7: Res Allow your body to recover completely Remember to adjust the weights and intensity based on your fitness level and gradually progress over time. Additionally, proper warm-u and cool-down sessions are essential before and after each workout to prevent injuries and enhance flexibility. Its always a good ide to consult with a fitness professional or your healthcare provider before starting a new workout routine, especially if you have an existing health concerns or conditions.Day 1: Upper Body Strength, Bench Press: 4 sets x 8-10 repsBent Over Rows: 3 sets x 10 repsOverhead Shoulder Press: 3 sets x 12 repsBicep Curls: 3 sets x 12 repsTricep Dips: 3 sets x 12 repsDay 2: Cardiovascular Exercise30 minutes of moderate-intensity cardio (e.g., running, cycling, elliptical)Day 3: Lower Body StrengthSquats: 4 sets x 10 repsDeadlifts: 3 sets x 8 repsLunges: 3 sets x 12 reps (each leg)Leg Press: 3 sets x 12 repsCalf Raises: 3 sets x 15 repsDay 4: Rest or Active RecoveryTake a day off from intense training or engage in light activities like walking, yoga, or stretchingDay 5: Cardiovascular Exercis30 minutes of high-intensity interval training (HIIT) or any other preferred cardio activityDay 6: Full Body Workout  Pull-ups or Lat Pulldowns: 3 sets x 10 rep Push-ups or Chest Flyes: 3 sets x 12 rep Leg Extensions: 3 sets x 12 rep Plank: 3 sets, hold for 60 seconds eac Russian Twists: 3 sets x 20 reps (for core Day 7: Res Allow your body to recover completely Remember to adjust the weights and intensity based on your fitness level and gradually progress over time. Additionally, proper warm-u and cool-down sessions are essential before and after each workout to prevent injuries and enhance flexibility. Its always a good ide to consult with a fitness professional or your healthcare provider before starting a new workout routine, especially if you have an existing health concerns or conditions.';
            loadingState.set(false);
        }, 1000);
    };
</script>

{#if $loadingState}
    <div class="h-full flex flex-col items-center justify-center">
        <div class="h-50 pb-5">
            <TextLoader />
        </div>
        <div class="h-50">
            <Spinner size={10} />
        </div>
    </div>
{:else if generatedPlan}
    <div class="h-full flex flex-col items-center justify-center pt-8">
        <div class="card md:w-[50%] p-16 mb-8">
            <h2 class="h2 text-center text-xl py-10">A plan created based on the data you entered:</h2>
            {@html generatedPlan}
        </div>
    </div>
{:else}
    <SurveyForm on:complete={generatePlan} />
{/if}
