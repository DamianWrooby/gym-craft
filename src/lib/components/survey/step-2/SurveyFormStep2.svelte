<script lang="ts">
    export let data: any;

    const goalsOptions = [
        {
            label: 'General fitness and health',
            value: 'general-fitness-and-health',
        },
        {
            label: 'Lose weight',
            value: 'lose-weight',
        },
        {
            label: 'Gain muscle',
            value: 'gain-muscle',
        },
        {
            label: 'Body toning and definition',
            value: 'body-definition',
        },
        {
            label: 'Improved athletic performance',
            value: 'athletic-performance',
        },
        {
            label: 'Stress reduction and mental well-being',
            value: 'stress-reduction',
        },
        {
            label: 'Other',
            value: 'other',
        },
    ];
</script>

<header class="card-header text-center text-xl">Goals and objectives</header>
<section class="p-4 w-full">
    <div class="flex flex-row gap-x-4 py-4">
        <label class="label pb-2 grow">
            <div>What are your fitness goals?</div>
            <div class="space-y-2">
                {#each goalsOptions as option}
                    <label class="flex items-center space-x-2">
                        <input
                            class="checkbox"
                            type="checkbox"
                            bind:checked={data.mainGoals[option.value]} />
                        <p>{option.label}</p>
                    </label>
                {/each}
            </div>
        </label>
    </div>
    {#if data.mainGoals['other']}
        <div class="flex flex-row gap-x-4 py-4">
            <label class="label pb-2 grow">
                <textarea
                    class="textarea"
                    rows="4"
                    placeholder="Describe your fitness goals..."
                    bind:value={data.otherGoalsDescription} />
            </label>
        </div>
    {/if}
</section>
