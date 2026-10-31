<script lang="ts" context="module">
    // One run per request id, even when the component re-mounts while the call is in flight.
    const started = new Set<string>();
</script>

<script lang="ts">
    import { m } from '$lib/paraglide/messages.js';
    import InfoTooltip from '$lib/components/info-tooltip/InfoTooltip.svelte';
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
        else if (result.kind === 'no-change') message = m.revision_nothing_left();
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

<section class="space-y-2" aria-label={m.revision_aria()}>
    {#if pending && !stalled}
        <div class="flex items-center gap-3" aria-live="polite">
            <span class="gc-pulse" aria-hidden="true">◆</span>
            <p class="text-sm text-slate-300">{m.revision_running()}</p>
        </div>
    {:else if pending}
        <p class="text-sm text-amber-300" role="status">
            {m.revision_stalled()}
        </p>
    {:else if failed}
        <div class="space-y-2" role="alert">
            <p class="text-sm text-red-400">{m.revision_failed()}</p>
            {#if request && request.retriesLeft > 0}
                <button type="button" class="gc-button" disabled={busy} on:click={retry}>
                    {busy ? m.revision_retrying() : m.revision_try_again({ left: request.retriesLeft })}
                </button>
            {:else}
                <p class="text-sm text-slate-400">{m.revision_no_retries()}</p>
            {/if}
        </div>
    {/if}

    {#if reason && !pending && (reason.outcome !== 'revise' || revision.generation === 'GENERATED')}
        <div
            class="text-sm {reason.outcome === 'revise' ? 'text-slate-300' : 'text-amber-200'} space-y-1"
            role="status">
            <p>
                {m.revision_loads({ done: reason.executedLoad, planned: reason.remainingLoad })}{reason.budget != null
                    ? ` ${m.revision_against_budget({ budget: reason.budget })}`
                    : ''}{reason.overspend > 0 ? `: ${m.revision_over_by({ amount: reason.overspend })}` : ''}.
                {#if reason.missedKeySessions.length}{m.revision_missed({
                        sessions: reason.missedKeySessions.join(', '),
                    })}{/if}
            </p>
            {#if reason.outcome === 'revise'}
                <p>{m.revision_rewrote({ from: reason.from })}</p>
                {#each reason.moved as line}<p>{line}</p>{/each}
            {:else if reason.outcome === 'capped'}
                <p>{m.revision_capped()}</p>
            {:else if reason.remainingLoad > 0}
                <p>
                    {m.revision_only_own()}
                </p>
            {:else}
                <p>{m.revision_none_left()}</p>
            {/if}
        </div>
    {/if}

    {#if !pending}
        <div class="flex items-center gap-2">
            <button type="button" class="gc-ghost" disabled={busy || atCap} on:click={ask}>
                {busy ? m.revision_requesting() : m.revision_ask()}
            </button>
            <InfoTooltip id="tip-revision" ariaLabel={m.help_aria()} placement="top">{m.help_revision()}</InfoTooltip>
        </div>
    {/if}
    {#if message}<p class="text-sm text-amber-300">{message}</p>{/if}

    {#if superseded.length}
        <details class="text-sm text-slate-300">
            <summary class="cursor-pointer text-slate-400"
                >{m.revision_what_changed({ count: superseded.length })}</summary>
            <ul class="mt-2 space-y-1">
                {#each superseded as s (s.id)}
                    <li class="line-through decoration-slate-500">
                        {s.scheduledDate} · {s.title} · {m.revision_load({ load: s.plannedLoad })}{s.byAthlete
                            ? ` · ${m.revision_your_edit()}`
                            : ''}
                    </li>
                    <li class="pl-4 text-slate-400">
                        → {s.replacedBy
                            ? `${s.replacedBy.title} · ${m.revision_load({ load: s.replacedBy.plannedLoad })}`
                            : m.revision_dropped()}
                    </li>
                {/each}
            </ul>
        </details>
    {/if}
</section>
