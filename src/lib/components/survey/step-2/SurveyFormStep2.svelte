<script lang="ts">
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
                            class="radio"
                            type="radio"
                            checked
                            name="radio-direct"
                            value={option.value} />
                        <p>{option.label}</p>
                    </label>
                {/each}
            </div>
        </label>
    </div>
    <div class="flex flex-row gap-x-4 py-4">
        <label class="label pb-2 grow">
            <textarea class="textarea" rows="4" placeholder="Describe your fitness goals..." />
        </label>
    </div>
</section>
