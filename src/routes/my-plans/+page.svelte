<script lang="ts">
    import { page } from '$app/stores';
    import { onMount } from 'svelte';
    import { getModalStore, Table, tableMapperValues } from '@skeletonlabs/skeleton';
    import type { TableSource } from '@skeletonlabs/skeleton';
    import type { Plan } from '@/models/plan/plan.model';

    const modalStore = getModalStore();

    const plans: Plan[] = $page.data.plans;
    const mappedPlans = plans.map((plan, index) => ({
        position: index + 1,
        name: plan.name,
        createdAt: plan.createdAt.toDateString(),
    }));

    onMount(() => {
        clearModals();
    });

    const clearModals = () => {
        modalStore.clear();
    };

    const tableData: TableSource = {
        head: ['#', 'Name', 'Date'],
        body: tableMapperValues(mappedPlans, ['position', 'name', 'createdAt']),
    };
</script>

<div class="h-full flex flex-col items-center justify-center pt-8">
    <div class="card md:w-[75%] p-16 mb-8">
        <Table source={tableData} />
    </div>
</div>
