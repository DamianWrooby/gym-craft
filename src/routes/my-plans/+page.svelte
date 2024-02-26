<script lang="ts">
    import { page } from '$app/stores';
    import { onMount } from 'svelte';
    import { getModalStore } from '@skeletonlabs/skeleton';
    import { Edit2Icon } from 'svelte-feather-icons';
    import type { Plan } from '@/models/plan/plan.model';

    const modalStore = getModalStore();

    const plans: Plan[] = $page.data.plans;
    const mappedPlans = plans.map((plan, index) => ({
        id: plan.id,
        position: index + 1,
        name: plan.name,
        createdAt: formatDate(plan.createdAt),
    }));

    onMount(() => {
        clearModals();
    });

    function clearModals() {
        modalStore.clear();
    };

    function formatDate(date: Date): string {
        return `${date.toDateString()} ${date.toLocaleTimeString()}`;
    };

    function handleRowSelection(event: CustomEvent<string[]>) {
        const planId = event.detail[0];
    };
</script>

<div class="h-full flex flex-col items-center justify-center pt-8">
    <div class="card md:w-[75%] p-16 mb-8">
        <h2 class="h2 text-center text-xl py-10">Generated plans</h2>
        <div class="md:w-[75%] m-auto">
            <ul class="list">
                {#each mappedPlans as plan}
                    <li class="group px-4 py-2 text-tertiary-500">
                        <span class="w-1/12">#{plan.position}</span>
                        <div class="w-5/12 flex flex-row items-center">
                            <span class="pr-2">{plan.name}</span>
                            <button type="button" class="p-2">
                                <Edit2Icon class="w-4 invisible group-hover:visible hover:text-tertiary-100 transition-colors" />
                            </button>
                        </div>
                    </li>
                {/each}
            </ul>
        </div>
    </div>
</div>
