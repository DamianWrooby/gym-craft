<script lang="ts" context="module">
    // One run per request id, even when the component re-mounts while the call is in flight.
    const started = new Set<string>();
</script>

<script lang="ts">
    import { onDestroy } from 'svelte';
    import { invalidateAll } from '$app/navigation';
    import { finalizeWeek, generateWeek, retryWeek } from '$lib/planner/generation-client';
    import type { PlanViewWeek } from '$lib/planner/plan-view';

    export let week: PlanViewWeek;
    export let userId: string;
    export let proxySession: string | null;

    const POLL_MS = 5000;
    /** Three minutes: longer than the proxy's own OpenAI timeout. */
    const MAX_POLLS = 36;
    let polls = 0;
    let stalled = false;
    let retryError: string | null = null;
    let retrying = false;
    let poll: ReturnType<typeof setTimeout> | null = null;

    $: request = week.request;
    $: failed = week.generation === 'FAILED';
    $: if (request && !failed) start(request.id, request.status);

    async function start(requestId: string, status: string) {
        if (started.has(requestId)) return;
        started.add(requestId);
        if (status === 'PENDING' && proxySession) {
            await generateWeek({ userId, weekId: week.id, aiRequestId: requestId, session: proxySession });
            started.delete(requestId);
            await invalidateAll();
        } else {
            // Another tab or an earlier visit is running it: wait for the row to finish.
            schedulePoll(requestId);
        }
    }

    function schedulePoll(requestId: string) {
        poll = setTimeout(async () => {
            const result = await finalizeWeek(userId, week.id);
            if (result.generation === 'PENDING') {
                if (++polls < MAX_POLLS) return schedulePoll(requestId);
                stalled = true;
                return;
            }
            started.delete(requestId);
            await invalidateAll();
        }, POLL_MS);
    }

    async function retry() {
        retrying = true;
        retryError = null;
        const result = await retryWeek(userId, week.id);
        if ('error' in result) {
            retryError = result.error;
            retrying = false;
            return;
        }
        await invalidateAll();
        retrying = false;
    }

    onDestroy(() => {
        if (poll) clearTimeout(poll);
    });
</script>

{#if failed}
    <div class="space-y-2" role="alert">
        <p class="text-sm text-red-400">Writing this week failed. Nothing was stored.</p>
        {#if request && request.retriesLeft > 0}
            <button type="button" class="gc-button" disabled={retrying} on:click={retry}>
                {retrying ? 'Retrying…' : `Try again (${request.retriesLeft} left)`}
            </button>
        {:else}
            <p class="text-sm text-slate-400">No retries left for this week.</p>
        {/if}
        {#if retryError}<p class="text-sm text-amber-300">{retryError}</p>{/if}
    </div>
{:else if stalled}
    <p class="text-sm text-amber-300" role="status">
        This week is taking longer than expected. Reload the page in a few minutes.
    </p>
{:else if request}
    <div class="flex items-center gap-3" aria-live="polite">
        <span class="gc-pulse" aria-hidden="true">◆</span>
        <p class="text-sm text-slate-300">
            Writing this week's sessions. This takes up to a minute. You can close this tab.
        </p>
    </div>
{/if}
