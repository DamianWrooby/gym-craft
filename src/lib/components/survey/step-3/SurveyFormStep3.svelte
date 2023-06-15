<script lang="ts">
    export let data: any;

    const experienceOptions = [
        {
            label: 'No experience',
            value: 'no-experience',
        },
        {
            label: '3-6 months',
            value: '3-6-months',
        },
        {
            label: '6-12 months',
            value: '6-12-months',
        },
        {
            label: '1-2 years',
            value: '1-2-years',
        },
        {
            label: '2-5 years',
            value: '2-5-years',
        },
        {
            label: '5+ years',
            value: '5+years',
        },
    ];
</script>

<header class="card-header text-center text-xl">Exercise history</header>
<section class="p-4 w-full">
    <div class="flex flex-row gap-x-4 py-4">
        <label class="label pb-2 grow">
            <div>Your fitness activity experience</div>
            <select class="select" title="Sex selection" bind:value={data.activityLevel}>
                {#each experienceOptions as option}
                    <option value={option.value}>{option.label}</option>
                {/each}
            </select>
        </label>
    </div>
    <div class="flex flex-row gap-x-4 py-4">
        <label class="label pb-2 grow">
            <div>Have you been involved in any fitness activities or sports in the past?</div>
            <textarea
                class="textarea"
                rows="4"
                placeholder="Describe your fitness activity history..."
                bind:value={data.activityHistory} />
        </label>
    </div>
    <div class="flex flex-row gap-x-4 py-4">
        <label class="label pb-2 grow">
            <div>
                What type of exercises or workouts have you enjoyed or found successful previously?
            </div>
            <textarea
                class="textarea"
                rows="4"
                placeholder="Describe the type of exercises you enjoyed the most..."
                bind:value={data.enjoyedExercises} />
        </label>
    </div>
    <div class="flex flex-row gap-x-4 py-4">
        <label class="label pb-2 grow">
            <div>Are there any exercises or activities that you dislike or want to avoid?</div>
            <textarea
                class="textarea"
                rows="4"
                placeholder="Describe the type of exercises you want to avoid..."
                bind:value={data.dislikedExercises} />
        </label>
    </div>
</section>
