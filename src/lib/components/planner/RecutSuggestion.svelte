<script lang="ts">
    // Drift suggests a recut; it never regenerates (ADR 0015, story 79). Dismissed, it returns only if
    // drift continues into a new week.
    import { createEventDispatcher } from 'svelte';
    import { invalidateAll } from '$app/navigation';
    import { dismissRecutSuggestion } from '$lib/planner/adapt-client';

    export let driftWeeks: number;
    export let userId: string;

    let busy = false;
    const dispatch = createEventDispatcher<{ recut: void }>();

    async function keepGoing() {
        busy = true;
        await dismissRecutSuggestion(userId);
        await invalidateAll();
        busy = false;
    }
</script>

<section class="gc-panel p-4 space-y-2" role="status" aria-label="Recut suggestion">
    <p class="text-sm text-amber-200">
        Key sessions were dropped or overridden in {driftWeeks} of the last 3 weeks. Your plan may no longer fit.
    </p>
    <p class="text-sm text-slate-300">
        Options: move the goal date, change the training school, or keep going as planned.
    </p>
    <div class="flex flex-wrap gap-2">
        <button type="button" class="gc-ghost" disabled={busy} on:click={() => dispatch('recut')}>
            Move the goal date
        </button>
        <button type="button" class="gc-ghost" disabled={busy} on:click={() => dispatch('recut')}>
            Change school
        </button>
        <button type="button" class="gc-ghost" disabled={busy} on:click={keepGoing}>Keep going</button>
    </div>
</section>
