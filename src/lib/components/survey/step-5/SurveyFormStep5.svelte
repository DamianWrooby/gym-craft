<script lang="ts">
    import type { FitnessLevelModel } from '@/models/survey/survey-form.model';

    export let data: FitnessLevelModel;
</script>

<header class="card-header text-center text-xl">Current fitness level</header>
<section class="p-4 w-full">
    <div class="flex flex-row gap-x-4 py-4">
        <label class="label pb-2 grow">
            <div>How would you rate your current fitness level on a scale of 1 to 10?</div>
            <select class="select" title="Fitness level" bind:value={data.fitnessLevel} required aria-required>
                {#each [...Array(10).keys()].map((i) => i + 1) as option}
                    <option value={option}>{option}</option>
                {/each}
            </select>
        </label>
    </div>
    <div class="flex flex-row gap-x-4 py-4">
        <label class="label pb-2 grow">
            <div>What activities do you currently engage in to stay active?</div>
            <textarea
                class="textarea"
                rows="4"
                placeholder="Describe your current activites..."
                bind:value={data.currentActivities} />
        </label>
    </div>
    <div class="flex flex-row gap-x-4 py-4">
        <label class="label pb-2 grow">
            <div>Are there any physical limitations or restrictions that need to be considered?</div>
            <textarea
                class="textarea"
                rows="4"
                placeholder="Describe your physical limitations..."
                bind:value={data.physicalLimitations} />
        </label>
    </div>
</section>
