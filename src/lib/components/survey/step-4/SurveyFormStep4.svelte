<script lang="ts">
    import type { LifestyleModel } from '@/models/survey/survey-form.model';

    export let data: LifestyleModel;

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
    const timePreferencesOptions: Array<{ label: string; value: string }> = [
        {
            label: 'in the morning',
            value: 'morning',
        },
        {
            label: 'in the afternoon',
            value: 'afternoon',
        },
        {
            label: 'in the evening',
            value: 'evening',
        },
    ];
    const trainingDays: Array<{ label: string; value: string }> = [
        {
            label: 'Monday',
            value: 'monday',
        },
        {
            label: 'Tuesday',
            value: 'tuesday',
        },
        {
            label: 'Wednesday',
            value: 'wednesday',
        },
        {
            label: 'Thursday',
            value: 'thursday',
        },
        {
            label: 'Friday',
            value: 'friday',
        },
        {
            label: 'Saturday',
            value: 'saturday',
        },
        {
            label: 'Sunday',
            value: 'sunday',
        },
    ];
</script>

<header class="card-header text-center text-xl">Lifestyle and schedule</header>
<section class="p-4 w-full">
    <div class="flex flex-row gap-x-4 py-4">
        <label class="label pb-2 grow">
            <div>What is your profession? Do you have a sedentary(office) or active job?</div>
            <select class="select" title="Proffession" bind:value={data.job} required aria-required>
                {#each proffesionOptions as option}
                    <option value={option.value}>{option.label}</option>
                {/each}
            </select>
        </label>
    </div>
    <div class="flex flex-row gap-x-4 py-4">
        <label class="label pb-2 grow">
            <div>How many hours per week can you commit to exercise?</div>
            <select
                class="select"
                title="Hour capacity"
                bind:value={data.hourCapacity}
                required
                aria-required>
                {#each capacityOptions as option}
                    <option value={option.value}>{option.label}</option>
                {/each}
            </select>
        </label>
    </div>
    <div class="flex flex-row gap-x-4 py-4">
        <label class="label pb-2 grow">
            <div>Do you have any time restrictions or preferences for training?</div>
            <div class="flex flex-row items-center justify-stretch">
                <span class="whitespace-nowrap pr-4">I prefer to train</span>
                <select
                    class="select"
                    title="Time preferences"
                    bind:value={data.timePreferences}
                    required
                    aria-required>
                    {#each timePreferencesOptions as option}
                        <option value={option.value}>{option.label}</option>
                    {/each}
                </select>
            </div>
        </label>
    </div>
    <div class="flex flex-row gap-x-4 py-4">
        <label class="label pb-2 grow">
            <div>Mark the days on which you can train</div>
            <div class="space-y-2">
                {#each trainingDays as option}
                    <label class="flex items-center space-x-2">
                        <input
                            class="checkbox"
                            type="checkbox"
                            bind:checked={data.trainingDays[option.value]} />
                        <p>{option.label}</p>
                    </label>
                {/each}
            </div>
        </label>
    </div>
</section>
