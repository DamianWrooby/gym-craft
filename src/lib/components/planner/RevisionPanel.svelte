<script lang="ts" context="module">
    // One run per request id, even when the component re-mounts while the call is in flight.
    const started = new Set<string>();
</script>

<script lang="ts">
    // The current week's revision (stories 69–75): runs one in flight, shows the verdict in numbers,
    // lets the athlete ask for one, and keeps the "what changed" view.
    import { onDestroy } from 'svelte';
    import { invalidateAll } from '$app/navigation';
    import { finalizeRevision, requestRevision, retryRevision, runRevision } from '$lib/planner/adapt-client';
    import type { AdaptRevision, SupersededSession } from '$lib/planner/adapt-view';

    export let revision: AdaptRevision;
    export let superseded: SupersededSession[];
    export let revisions: { used: number; cap: number };
    export let userId: string;
    export let proxySession: string | null;

    const POLL_MS = 5000;
    /** Three minutes: longer than the proxy's own OpenAI timeout. */
    const MAX_POLLS = 36;
    let polls = 0;
    let stalled = false;
    let busy = false;
    let message: string | null = null;
    let poll: ReturnType<typeof setTimeout> | null = null;

    $: request = revision.request;
    $: pending = revision.generation === 'PENDING';
    $: failed = revision.generation === 'FAILED';
    $: reason = revision.reason;
    $: atCap = revisions.used >= revisions.cap;
    $: if (pending && request) start(request.id, request.status);

    async function start(requestId: string, status: string) {
        if (started.has(requestId)) return;
        started.add(requestId);
        if (status === 'PENDING' && proxySession) {
            await runRevision({ userId, weekId: revision.weekId, aiRequestId: requestId, session: proxySession });
            started.delete(requestId);
            await invalidateAll();
        } else {
            // Another tab or an earlier visit is running it: wait for the row to finish.
            schedulePoll(requestId);
        }
    }

    function schedulePoll(requestId: string) {
        poll = setTimeout(async () => {
            const result = await finalizeRevision(userId, revision.weekId);
            if (result.revision === 'PENDING') {
                if (++polls < MAX_POLLS) return schedulePoll(requestId);
                stalled = true;
                return;
            }
            started.delete(requestId);
            await invalidateAll();
        }, POLL_MS);
    }

    async function ask() {
        busy = true;
        message = null;
        const result = await requestRevision(userId, 'ATHLETE');
        if ('error' in result) message = result.error;
        else if (result.kind === 'no-change') message = 'Nothing is left to rewrite this week.';
        await invalidateAll();
        busy = false;
    }

    async function retry() {
        busy = true;
        message = null;
        const result = await retryRevision(userId, revision.weekId);
        if ('error' in result) message = result.error;
        await invalidateAll();
        busy = false;
    }

    onDestroy(() => {
        if (poll) clearTimeout(poll);
    });
</script>

<section class="space-y-2" aria-label="Revision">
    {#if pending && !stalled}
        <div class="flex items-center gap-3" aria-live="polite">
            <span class="gc-pulse" aria-hidden="true">◆</span>
            <p class="text-sm text-slate-300">Rewriting the rest of this week. This takes up to a minute.</p>
        </div>
    {:else if pending}
        <p class="text-sm text-amber-300" role="status">
            The revision is taking longer than expected. Reload the page in a few minutes.
        </p>
    {:else if failed}
        <div class="space-y-2" role="alert">
            <p class="text-sm text-red-400">The revision failed. Your week is unchanged and nothing was counted.</p>
            {#if request && request.retriesLeft > 0}
                <button type="button" class="gc-button" disabled={busy} on:click={retry}>
                    {busy ? 'Retrying…' : `Try again (${request.retriesLeft} left)`}
                </button>
            {:else}
                <p class="text-sm text-slate-400">No retries left for this revision.</p>
            {/if}
        </div>
    {/if}

    {#if reason && !pending && (reason.outcome !== 'revise' || revision.generation === 'GENERATED')}
        <div
            class="text-sm {reason.outcome === 'revise' ? 'text-slate-300' : 'text-amber-200'} space-y-1"
            role="status">
            <p>
                Done {reason.executedLoad} + planned {reason.remainingLoad}{reason.budget != null
                    ? ` against a budget of ${reason.budget}`
                    : ''}{reason.overspend > 0 ? `: over by ${reason.overspend}` : ''}.
                {#if reason.missedKeySessions.length}Missed key sessions: {reason.missedKeySessions.join(', ')}.{/if}
            </p>
            {#if reason.outcome === 'revise'}
                <p>GymCraft rewrote the rest of this week from {reason.from}.</p>
            {:else if reason.outcome === 'capped'}
                <p>You have used every revision this month. The week stays as written; edit sessions by hand.</p>
            {:else if reason.remainingLoad > 0}
                <p>
                    Only your own sessions are left, so GymCraft will not change them. Edit them, or rewrite the week.
                </p>
            {:else}
                <p>No sessions are left this week to change.</p>
            {/if}
        </div>
    {/if}

    {#if !pending}
        <button type="button" class="gc-ghost" disabled={busy || atCap} on:click={ask}>
            {busy ? 'Requesting…' : 'Rewrite the rest of my week'}
        </button>
    {/if}
    {#if message}<p class="text-sm text-amber-300">{message}</p>{/if}

    {#if superseded.length}
        <details class="text-sm text-slate-300">
            <summary class="cursor-pointer text-slate-400">What changed ({superseded.length})</summary>
            <ul class="mt-2 space-y-1">
                {#each superseded as s (s.id)}
                    <li class="line-through decoration-slate-500">
                        {s.scheduledDate} · {s.title} · load {s.plannedLoad}{s.byAthlete ? ' · your edit' : ''}
                    </li>
                    <li class="pl-4 text-slate-400">
                        → {s.replacedBy ? `${s.replacedBy.title} · load ${s.replacedBy.plannedLoad}` : 'dropped'}
                    </li>
                {/each}
            </ul>
        </details>
    {/if}
</section>
