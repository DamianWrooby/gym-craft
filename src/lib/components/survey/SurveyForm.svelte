<script lang="ts">
    import SurveyFormStep1 from '@components/survey/step-1/SurveyFormStep1.svelte';
    import SurveyFormStep2 from '@components/survey/step-2/SurveyFormStep2.svelte';
    import SurveyFormStep3 from '@components/survey/step-3/SurveyFormStep3.svelte';

    let step = 1;

    function handleNextClick() {
        step++;
    }
    function handlePrevClick() {
        step--;
    }
</script>

<h1 class="h1 text-center text-xl py-10">
    Fill out the survey and generate a training plan tailored to you
</h1>
<div class="card w-1/2 m-auto px-2">
    {#if step === 1}
        <SurveyFormStep1 on:nextClick={handleNextClick} />
    {:else if step === 2}
        <SurveyFormStep2 on:nextClick={handleNextClick} on:prevClick={handlePrevClick} />
    {:else if step === 3}
        <SurveyFormStep3 on:nextClick={handleNextClick} on:prevClick={handlePrevClick} />
    {/if}
</div>
