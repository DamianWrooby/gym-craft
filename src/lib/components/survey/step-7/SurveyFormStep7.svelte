<script lang="ts">
    import type { AdditionalInfoModel } from '@/models/survey/survey-form.model';

    export let data: AdditionalInfoModel;
</script>

<header class="card-header text-center text-xl">Additional information</header>
<section class="p-4 w-full">
    <div class="flex flex-row gap-x-4 py-4">
        <div class="space-y-2">
            <label class="label pb-2 grow">
                <div>Set cycle length (0-12 weeks)</div>
                <input
                    class="input w-1/2"
                    title="Type your age"
                    type="number"
                    required
                    aria-required
                    min="0"
                    max="12"
                    bind:value={data.cycleLength} />
            </label>
        </div>
    </div>
</section>
