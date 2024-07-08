<script lang="ts">
    import { page, navigating } from '$app/stores';
    import { goto } from '$app/navigation';
    import { ArrowLeftIcon } from 'svelte-feather-icons';
    import Card from '$lib/components/card/Card.svelte';
    import Spinner from '$lib/components/loading/spinner/Spinner.svelte';
    import DownloadAsPdf from '$lib/components/download-as-pdf/DownloadAsPdf.svelte';
    import type { Plan } from '@prisma/client';

    const plan: Plan | null = $page.data.plan;
    let planContainer: HTMLElement | null = null;

    function goBackToPlanList() {
        goto('/my-plans');
    }
</script>

<Card width="[75%]">
    {#if $navigating}
        <Spinner size={10} />
    {:else}
        <div class="flex justify-between">
            <button type="button" on:click={() => goBackToPlanList()}>
                <ArrowLeftIcon class="cursor-pointer text-surface-400 hover:text-surface-300" />
            </button>
            {#if plan && planContainer}
                <DownloadAsPdf htmlElement={planContainer} fileName={plan.name} />
            {/if}
        </div>
        {#if plan !== null}
            <div class="mb-5" bind:this={planContainer}>
                <h2 class="h2 text-center text-xl py-10">{plan.name}</h2>
                {@html plan.description}
            </div>
        {:else}
            <h2 class="h2 text-center text-xl py-10">Plan not found</h2>
        {/if}
    {/if}
</Card>
