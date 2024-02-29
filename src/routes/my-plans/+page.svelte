<script lang="ts">
    import { page } from '$app/stores';
    import { onMount } from 'svelte';
    import { getModalStore } from '@skeletonlabs/skeleton';
    import { Edit2Icon, CheckIcon, XIcon } from 'svelte-feather-icons';
    import type { Plan } from '@/models/plan/plan.model';

    const modalStore = getModalStore();

    const plans: Plan[] = $page.data.plans;
    const mappedPlans = plans.map((plan, index) => ({
        id: plan.id,
        position: index + 1,
        name: plan.name,
        createdAt: formatDate(plan.createdAt),
    }));
    let editNameEnabledIndex: number = -1;

    onMount(() => {
        clearModals();
    });

    function clearModals() {
        modalStore.clear();
    }

    function formatDate(date: Date): string {
        return `${date.toDateString()} ${date.toLocaleTimeString()}`;
    }
</script>

<div class="h-full flex flex-col items-center justify-center pt-8">
    <div class="card md:w-[75%] p-16 mb-8">
        <h2 class="h2 text-center text-xl py-10">Generated plans</h2>
        <div class="md:w-[75%] m-auto">
            <ul class="list border rounded-2xl border-surface-500">
                {#each mappedPlans as plan, index}
                    <li
                        class="group !m-0 px-4 py-2 text-tertiary-500 border-b-1 first:rounded-t-2xl last:rounded-b-2xl rounded-none odd:bg-surface-900 even:bg-surface-800">
                        <span class="w-1/12">#{plan.position}</span>
                        <div class="w-5/12 flex flex-row items-center">
                            {#if editNameEnabledIndex === index}
                                <input
                                    class="input"
                                    title="Plan name input"
                                    type="text"
                                    value={plan.name}
                                    required
                                    aria-required />
                                <button type="button" class="py-2 px-1">
                                    <CheckIcon class="w-4 text-success-700 hover:text-success-500 transition-colors" />
                                </button>
                                <button type="button" class="py-2 px-1">
                                    <XIcon class="w-4 text-error-700 hover:text-error-500 transition-colors" />
                                </button>
                            {:else}
                                <span class="pl-3 pr-2">{plan.name}</span>
                                <button type="button" class="p-2" on:click={() => (editNameEnabledIndex = index)}>
                                    <Edit2Icon
                                        class="w-4 invisible group-hover:visible hover:text-tertiary-100 transition-colors" />
                                </button>
                            {/if}
                        </div>
                    </li>
                {/each}
            </ul>
        </div>
    </div>
</div>
