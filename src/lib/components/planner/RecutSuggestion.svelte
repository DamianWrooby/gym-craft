<script lang="ts">
    import { m } from '$lib/paraglide/messages.js';
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

<section class="gc-panel p-4 space-y-2" role="status" aria-label={m.recut_suggestion_aria()}>
    <p class="text-sm text-amber-200">
        {m.recut_suggestion_drift({ weeks: driftWeeks })}
    </p>
    <p class="text-sm text-slate-300">
        {m.recut_suggestion_options()}
    </p>
    <div class="flex flex-wrap gap-2">
        <button type="button" class="gc-ghost" disabled={busy} on:click={() => dispatch('recut')}>
            {m.recut_move_date()}
        </button>
        <button type="button" class="gc-ghost" disabled={busy} on:click={() => dispatch('recut')}>
            {m.recut_change_school()}
        </button>
        <button type="button" class="gc-ghost" disabled={busy} on:click={keepGoing}>{m.recut_keep_going()}</button>
    </div>
</section>
