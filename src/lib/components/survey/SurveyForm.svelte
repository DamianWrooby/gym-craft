<script lang="ts">
    const sexOptions = {
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

<div class="card w-3/5">
    <header class="card-header text-center text-xl">
        Fill out the survey and generate a training plan tailored to you
    </header>
    <section class="p-4 w-full">
        <div class="flex flex-row gap-x-4">
            <label class="label pb-2 grow">
                <span>Sex</span>
                <select class="select" title="Sex selection">
                    {#each Object.values(sexOptions) as option}
                        <option value={option.value}>{option.label}</option>
                    {/each}
                </select>
            </label>
            <label class="label pb-2 grow">
                <span>Age</span>
                <input class="input" title="Type your age" type="number" max="150" min="10" />
            </label>
        </div>
    </section>
    <footer class="card-footer">(footer)</footer>
</div>
