<script lang="ts">
    import { page, navigating } from '$app/stores';
    import { goto } from '$app/navigation';
    import { ArrowLeftIcon } from 'svelte-feather-icons';
    import Card from '$lib/components/card/Card.svelte';
    import Spinner from '$lib/components/loading/spinner/Spinner.svelte';
    import type { Plan } from '@prisma/client';

    const plan: Plan | null = $page.data.plan;

    function goBackToPlanList() {
        goto('/my-plans');
    }
</script>

<Card width="[75%]">
    {#if $navigating}
        <Spinner size={10} />
    {:else}
        <button type="button" on:click={() => goBackToPlanList()}>
            <ArrowLeftIcon class="cursor-pointer text-surface-400 hover:text-surface-300" />
        </button>
        {#if plan !== null}
            <h2 class="h2 text-center text-xl py-10">{plan.name}</h2>
            {@html plan.description}
        {:else}
            <h2 class="h2 text-center text-xl py-10">Plan not found</h2>
        {/if}
    {/if}
</Card>
