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
</script>

<header class="card-header text-center text-xl">Available equipment</header>
<section class="p-4 w-full">
    <div class="flex flex-row gap-x-4 py-4">
        <label class="label pb-2 grow">
            <div>What sports equipment do you have access to?</div>
            <div class="space-y-2">
                {#each equipmentOptions as option}
                    <label class="flex items-center space-x-2">
                        <input class="checkbox" type="checkbox" bind:checked={data[option.value]} />
                        <p>{option.label}</p>
                    </label>
                {/each}
            </div>
        </label>
    </div>
</section>
