<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import { ArrowRightIcon, ArrowLeftIcon } from 'svelte-feather-icons';

    const dispatch = createEventDispatcher();

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

    function handleNextClick() {
        dispatch('nextClick');
    }
    function handlePrevClick() {
        dispatch('prevClick');
    }
</script>

<header class="card-header text-center text-xl">Exercise history</header>
<section class="p-4 w-full">
    <div class="flex flex-row gap-x-4 py-4">
        <label class="label pb-2 grow">
            <div>Your fitness activity experience</div>
            <select class="select" title="Sex selection">
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
                placeholder="Describe your fitness activity history..." />
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
                placeholder="Describe the type of exercises you enjoyed the most..." />
        </label>
    </div>
    <div class="flex flex-row gap-x-4 py-4">
        <label class="label pb-2 grow">
            <div>Are there any exercises or activities that you dislike or want to avoid?</div>
            <textarea
                class="textarea"
                rows="4"
                placeholder="Describe the type of exercises you want to avoid..." />
        </label>
    </div>
</section>
<footer class="card-footer flex justify-between">
    <button class="btn variant-filled-secondary group" type="button" on:click={handlePrevClick}>
        <ArrowLeftIcon class="group-hover:animate-pulse" />
        <span>Previous</span>
    </button>
    <button class="btn variant-filled-secondary group" type="button" on:click={handleNextClick}>
        <span>Next</span>
        <ArrowRightIcon class="group-hover:animate-pulse" />
    </button>
</footer>
