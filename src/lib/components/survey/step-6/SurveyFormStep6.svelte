<script lang="ts">
    import type { EquipmentModel } from '@/models/survey/survey-form.model';

    export let data: EquipmentModel;

    const equipmentOptions: { label: string; value: keyof EquipmentModel }[] = [
        {
            label: 'Free weights zone (dumbbells, barbells, benches)',
            value: 'freeWeights',
        },
        {
            label: 'Training machines',
            value: 'trainingMachines',
        },
        {
            label: 'Treadmill',
            value: 'treadmill',
        },
        {
            label: 'Rowing machine',
            value: 'rowingMachine',
        },
        {
            label: 'Stationary bike',
            value: 'stationaryBike',
        },
        {
            label: 'Elliptical',
            value: 'elliptical',
        },
        {
            label: 'Stair master',
            value: 'stairMaster',
        },
        {
            label: 'Resistance bands',
            value: 'resistanceBands',
        },
        {
            label: 'TRX',
            value: 'trx',
        },
        {
            label: 'Calisthenics',
            value: 'calisthenics',
        },
        {
            label: 'MTB bike',
            value: 'mtbBike',
        },
        {
            label: 'Road bike',
            value: 'roadBike',
        },
    ];

    $: allSelected = equipmentOptions.every((option) => data[option.value]);
    $: someSelected = equipmentOptions.some((option) => data[option.value]);

    function toggleAll() {
        const checked = !allSelected;
        equipmentOptions.forEach((option) => (data[option.value] = checked));
    }
</script>

<header class="card-header text-center text-xl">Available equipment</header>
<section class="p-4 w-full">
    <div class="flex flex-row gap-x-4 py-4">
        <div class="label pb-2 grow">
            <div>What sports equipment do you have access to?</div>
            <div class="space-y-2">
                <label class="flex items-center space-x-2 pb-2 border-b border-surface-500/30">
                    <input
                        class="checkbox"
                        type="checkbox"
                        checked={allSelected}
                        indeterminate={someSelected && !allSelected}
                        on:change={toggleAll} />
                    <p class="font-semibold">Select all</p>
                </label>
                {#each equipmentOptions as option}
                    <label class="flex items-center space-x-2">
                        <input class="checkbox" type="checkbox" bind:checked={data[option.value]} />
                        <p>{option.label}</p>
                    </label>
                {/each}
            </div>
        </div>
    </div>
</section>
