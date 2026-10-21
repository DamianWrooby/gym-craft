<script lang="ts">
    // Daily one-tap check-in (story 77) and the revision it may propose (story 78).
    import { invalidateAll } from '$app/navigation';
    import { CHECK_IN_REASONS, FEELINGS, type CheckInReason, type Feeling } from '$lib/planner/core/check-in';
    import { dismissCheckInProposal, requestRevision, saveCheckIn } from '$lib/planner/adapt-client';
    import type { AdaptView } from '$lib/planner/adapt-view';

    export let checkIn: AdaptView['checkIn'];
    export let userId: string;
    /** No revision may start while one is running. */
    export let revisionPending: boolean;

    const FEELING_LABELS: Record<Feeling, string> = { GOOD: 'Good', SO_SO: 'So-so', POOR: 'Poor' };
    const REASON_LABELS: Record<CheckInReason, string> = {
        ILL: 'Ill',
        TIRED: 'Tired',
        SORE: 'Sore',
        STRESSED: 'Stressed',
        POOR_SLEEP: 'Poor sleep',
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

<section class="gc-panel p-4 space-y-3" aria-label="Daily check-in">
    <div class="flex flex-wrap items-center gap-2">
        <span class="text-xs uppercase tracking-widest text-slate-500">How do you feel today?</span>
        {#each FEELINGS as feeling}
            <button
                type="button"
                class="gc-ghost gc-choice"
                aria-pressed={checkIn.today?.feeling === feeling}
                disabled={busy}
                on:click={() => (feeling === 'POOR' ? (choosingReason = true) : save(feeling))}>
                {FEELING_LABELS[feeling]}
            </button>
        {/each}
    </div>
    {#if choosingReason}
        <div class="flex flex-wrap items-center gap-2">
            <span class="text-sm text-slate-400">Why? (optional)</span>
            {#each CHECK_IN_REASONS as reason}
                <button type="button" class="gc-ghost" disabled={busy} on:click={() => save('POOR', reason)}>
                    {REASON_LABELS[reason]}
                </button>
            {/each}
            <button type="button" class="gc-ghost" disabled={busy} on:click={() => save('POOR')}>Skip</button>
        </div>
    {:else if checkIn.today}
        <p class="text-sm text-slate-400">
            Today: {FEELING_LABELS[checkIn.today.feeling]}{checkIn.today.reason
                ? ` · ${REASON_LABELS[checkIn.today.reason]}`
                : ''}
        </p>
    {/if}

    {#if checkIn.proposal.proposed && !revisionPending}
        <div class="space-y-2 border-t border-slate-700/60 pt-3" role="status">
            <p class="text-sm text-amber-200">
                {checkIn.proposal.illDay ? 'You checked in ill' : `${checkIn.proposal.poorDays} poor days`} this week. Make
                the rest of the week easier?
            </p>
            <div class="flex flex-wrap gap-2">
                <button type="button" class="gc-button" disabled={busy} on:click={confirm}>Rewrite it easier</button>
                <button type="button" class="gc-ghost" disabled={busy} on:click={dismiss}>Keep the week</button>
            </div>
        </div>
    {/if}
    {#if error}<p class="text-sm text-amber-300">{error}</p>{/if}
</section>
