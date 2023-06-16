<script lang="ts">
    export let data: any;

    const proffesionOptions: Array<{ label: string; value: string }> = [
        {
            label: 'Sedentary',
            value: 'sedentary',
        },
        {
            label: 'Active',
            value: 'active',
        },
        {
            label: 'Varied',
            value: 'varied',
        },
    ];
    const capacityOptions: Array<{ label: string; value: string }> = [
        {
            label: '1-3 hours/week',
            value: '1-3h',
        },
        {
            label: '3-5 hours/week',
            value: '3-5h',
        },
        {
            label: '5-7 hours/week',
            value: '5-7h',
        },
        {
            label: '7-10 hours/week',
            value: '7-10h',
        },
        {
            label: '10-14 hours/week',
            value: '10-14h',
        },
        {
            label: '15+ hours/week',
            value: '15h',
        },
        {
            label: '20+ hours/week',
            value: '20h',
        },
        {
            label: '30+ hours/week',
            value: '30h',
        },
        {
            label: 'unlimited',
            value: 'unlimited',
        },
    ];
</script>

<header class="card-header text-center text-xl">Lifestyle and schedule</header>
<section class="p-4 w-full">
    <div class="flex flex-row gap-x-4 py-4">
        <label class="label pb-2 grow">
            <div>What is your profession? Do you have a sedentary(office) or active job?</div>
            <select class="select" title="Proffession" bind:value={data.job}>
                {#each proffesionOptions as option}
                    <option value={option.value}>{option.label}</option>
                {/each}
            </select>
        </label>
    </div>
    <div class="flex flex-row gap-x-4 py-4">
        <label class="label pb-2 grow">
            <div>How many hours per week can you commit to exercise?</div>
            <select class="select" title="Hour capacity" bind:value={data.hourCapacity}>
                {#each capacityOptions as option}
                    <option value={option.value}>{option.label}</option>
                {/each}
            </select>
        </label>
    </div>
</section>
