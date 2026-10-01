<script lang="ts">
    import type { SexOptions } from '@/models/survey/sex-option.model';
    import type { PersonalInfoModel } from '@/models/survey/survey-form.model';

    export let data: PersonalInfoModel;

    const sexOptions: SexOptions = {
        male: {
            label: 'Male',
            value: 'male',
        },
        female: {
            label: 'Female',
            value: 'female',
        },
        other: {
            label: 'Other',
            value: 'other',
        },
    };
</script>

<header class="card-header text-center text-xl">Personal information</header>
<section class="p-4 w-full">
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 py-4">
        <label class="label">
            <div>Sex</div>
            <select class="select w-full" title="Sex selection" bind:value={data.sex} required aria-required>
                {#each Object.values(sexOptions) as option}
                    <option value={option.value}>{option.label}</option>
                {/each}
            </select>
        </label>
        <label class="label">
            <div>Age</div>
            <input
                class="input w-full"
                title="Type your age"
                type="number"
                required
                aria-required
                min="10"
                max="150"
                bind:value={data.age} />
        </label>
    </div>
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 py-4">
        <label class="label">
            <div>Height</div>
            <div class="flex items-center gap-2">
                <input
                    class="input w-full"
                    title="Your height"
                    type="number"
                    required
                    aria-required
                    min="50"
                    max="250"
                    bind:value={data.height} />
                <span class="text-sm opacity-75">cm</span>
            </div>
        </label>
        <label class="label">
            <div>Weight</div>
            <div class="flex items-center gap-2">
                <input
                    class="input w-full"
                    title="Your weight"
                    type="number"
                    required
                    aria-required
                    min="30"
                    max="350"
                    bind:value={data.weight} />
                <span class="text-sm opacity-75">kg</span>
            </div>
        </label>
    </div>
    <div class="flex flex-row gap-x-4 py-4">
        <label class="label pb-2 grow">
            <div>Do you have any existing medical conditions or injuries that may affect your training?</div>
            <textarea
                class="textarea"
                rows="4"
                placeholder="Describe your medical conditions or injuries..."
                bind:value={data.medicalConditions} />
        </label>
    </div>
</section>
