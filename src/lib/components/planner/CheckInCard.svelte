<script lang="ts">
    import { m } from '$lib/paraglide/messages.js';
    import InfoTooltip from '$lib/components/info-tooltip/InfoTooltip.svelte';
    // Daily one-tap check-in (story 77) and the revision it may propose (story 78).
    import { invalidateAll } from '$app/navigation';
    import { CHECK_IN_REASONS, FEELINGS, type CheckInReason, type Feeling } from '$lib/planner/core/check-in';
    import { dismissCheckInProposal, requestRevision, saveCheckIn } from '$lib/planner/adapt-client';
    import type { AdaptView } from '$lib/planner/adapt-view';

    export let checkIn: AdaptView['checkIn'];
    export let userId: string;
    /** No revision may start while one is running. */
    export let revisionPending: boolean;

    const FEELING_LABELS: Record<Feeling, () => string> = {
        GOOD: m.checkin_good,
        SO_SO: m.checkin_so_so,
        POOR: m.checkin_poor,
    };
    const REASON_LABELS: Record<CheckInReason, () => string> = {
        ILL: m.checkin_ill,
        TIRED: m.checkin_tired,
        SORE: m.checkin_sore,
        STRESSED: m.checkin_stressed,
        POOR_SLEEP: m.checkin_poor_sleep,
    };

    let choosingReason = false;
    let busy = false;
    let error: string | null = null;

    async function save(feeling: Feeling, reason: CheckInReason | null = null) {
        busy = true;
        error = null;
        const result = await saveCheckIn(userId, feeling, reason);
        if ('error' in result) error = result.error;
        choosingReason = false;
        await invalidateAll();
        busy = false;
    }

    async function confirm() {
        busy = true;
        const result = await requestRevision(userId, 'CHECK_IN');
        if ('error' in result) error = result.error;
        await invalidateAll();
        busy = false;
    }

    async function dismiss() {
        busy = true;
        await dismissCheckInProposal(userId);
        await invalidateAll();
        busy = false;
    }
</script>

<section class="gc-panel p-4 space-y-3" aria-label={m.checkin_aria()}>
    <div class="flex flex-wrap items-center gap-2">
        <span class="flex items-center gap-1 text-xs uppercase tracking-widest text-slate-500">
            {m.checkin_question()}
            <InfoTooltip id="tip-checkin" ariaLabel={m.help_aria()} placement="top">{m.help_checkin()}</InfoTooltip>
        </span>
        {#each FEELINGS as feeling}
            <button
                type="button"
                class="gc-ghost gc-choice"
                aria-pressed={checkIn.today?.feeling === feeling}
                disabled={busy}
                on:click={() => (feeling === 'POOR' ? (choosingReason = true) : save(feeling))}>
                {FEELING_LABELS[feeling]()}
            </button>
        {/each}
    </div>
    {#if choosingReason}
        <div class="flex flex-wrap items-center gap-2">
            <span class="text-sm text-slate-400">{m.checkin_why()}</span>
            {#each CHECK_IN_REASONS as reason}
                <button type="button" class="gc-ghost" disabled={busy} on:click={() => save('POOR', reason)}>
                    {REASON_LABELS[reason]()}
                </button>
            {/each}
            <button type="button" class="gc-ghost" disabled={busy} on:click={() => save('POOR')}
                >{m.checkin_skip()}</button>
        </div>
    {:else if checkIn.today}
        <p class="text-sm text-slate-400">
            {m.checkin_today({ feeling: FEELING_LABELS[checkIn.today.feeling]() })}{checkIn.today.reason
                ? ` · ${REASON_LABELS[checkIn.today.reason]()}`
                : ''}
        </p>
    {/if}

    {#if checkIn.proposal.proposed && !revisionPending}
        <div class="space-y-2 border-t border-slate-700/60 pt-3" role="status">
            <p class="text-sm text-amber-200">
                {checkIn.proposal.illDay
                    ? m.checkin_proposal_ill()
                    : m.checkin_proposal_poor({ days: checkIn.proposal.poorDays })}
            </p>
            <div class="flex flex-wrap gap-2">
                <button type="button" class="gc-button" disabled={busy} on:click={confirm}
                    >{m.checkin_rewrite_easier()}</button>
                <button type="button" class="gc-ghost" disabled={busy} on:click={dismiss}
                    >{m.checkin_keep_week()}</button>
            </div>
        </div>
    {/if}
    {#if error}<p class="text-sm text-amber-300">{error}</p>{/if}
</section>
