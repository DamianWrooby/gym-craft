<script lang="ts">
    // Every trim and every ask states the numbers, the action, why that session and what was
    // protected (ADR 0013). A silent trim is one line that expands.
    import { createEventDispatcher } from 'svelte';
    import { invalidateAll } from '$app/navigation';
    import { answerDecision } from '$lib/planner/generation-client';
    import type { DecisionOption } from '$lib/planner/core/conflict';
    import type { PlanViewWeek } from '$lib/planner/plan-view';

    export let week: Pick<PlanViewWeek, 'id' | 'conflict' | 'decision'>;
    export let schoolName: string;
    export let userId: string;
    /** Weeks of this plan the athlete kept over budget: the school-fit evidence (ADR 0013). */
    export let keptWeeks = 0;

    const dispatch = createEventDispatcher<{ recut: void }>();

    const OPTION_LABELS: Record<DecisionOption, (title: string) => string> = {
        DROP: (t) => `Drop ${t}`,
        DOWNGRADE: (t) => `Downgrade ${t} one intensity step`,
        KEEP: () => 'Keep the week as written and go over budget',
        REWRITE: () => 'Rewrite the week',
    };
    const ANSWERED: Record<string, string> = {
        DROPPED: 'You dropped',
        DOWNGRADED: 'You downgraded',
        KEPT: 'You kept',
    };

    $: placement = week.conflict?.placement ?? null;
    $: asked = placement?.asked ?? null;
    $: budget = week.conflict?.budget ?? null;
    let saving = false;
    let error: string | null = null;

    const titles = (items: { title: string }[]) => items.map((i) => i.title).join(', ');
    const trimp = (n: number) => `${Math.round(n)} TRIMP`;
    const pct = (share: number) => `${Math.round(share * 100)}%`;

    async function answer(choice: DecisionOption) {
        saving = true;
        error = null;
        const result = await answerDecision(userId, week.id, choice);
        if ('error' in result) error = result.error;
        else await invalidateAll();
        saving = false;
    }
</script>

{#if placement && asked && week.decision === 'PENDING'}
    <div class="gc-stat space-y-2" role="alert">
        <p class="text-sm text-slate-100">
            {asked.title} does not fit your training days with the rest of this week, so it is not in the week.
        </p>
        <ul class="ml-4 list-disc text-xs text-slate-400">
            <li>Rules the week broke: {placement.violations.join('; ')}.</li>
            {#if placement.removed.length}
                <li>
                    Also removed: {placement.removed.map((r) => `${r.title} (${trimp(r.plannedLoad)})`).join(', ')}.
                </li>
            {/if}
            <li>{asked.title} ({trimp(asked.plannedLoad)}) is a key session, so you decide.</li>
            <li>Protected: {placement.protected.join(', ') || 'no other key sessions'}.</li>
        </ul>
        <div class="flex flex-wrap gap-2">
            {#each asked.options as option}
                <button
                    type="button"
                    class={option === 'DROP' ? 'gc-ghost' : 'gc-button'}
                    disabled={saving}
                    on:click={() => answer(option)}>
                    {OPTION_LABELS[option](asked.title)}
                </button>
            {/each}
        </div>
        {#if error}<p class="text-sm text-amber-300">{error}</p>{/if}
    </div>
{:else if asked && week.decision === 'DROPPED'}
    <p class="text-sm text-slate-300">You dropped {asked.title} so the week fits your training days.</p>
{:else if placement && placement.removed.length > 0}
    <details class="text-sm text-slate-300">
        <summary>Removed {titles(placement.removed)} so the week fits your training days.</summary>
        <ul class="mt-1 ml-4 list-disc text-xs text-slate-400">
            <li>Rules the week broke: {placement.violations.join('; ')}.</li>
            <li>Removed: {placement.removed.map((r) => `${r.title} (${trimp(r.plannedLoad)})`).join(', ')}.</li>
            <li>Why those: {schoolName}'s cut order, cheapest to lose first: {placement.cutOrder.join(' → ')}.</li>
            <li>Protected: {placement.protected.join(', ') || 'no key sessions'}.</li>
        </ul>
    </details>
{/if}

{#if budget}
    {@const f = budget.facts}
    {#if budget.kind === 'TRIM'}
        <details class="text-sm text-slate-300">
            <summary
                >{#if f.removed.length > 0}Trimmed {titles(f.removed)}{:else}Nothing could be trimmed{/if}{#if f.stillOver > 0};
                    the week is still {trimp(f.stillOver)} over budget.{:else}
                    to fit the recovery budget.{/if}</summary>
            <ul class="mt-1 ml-4 list-disc text-xs text-slate-400">
                <li>
                    Planned {trimp(f.plannedTotal)} against a budget of {trimp(f.budget)}: {trimp(f.overspend)} over.
                </li>
                <li>Removed: {f.removed.map((r) => `${r.title} (${trimp(r.plannedLoad)})`).join(', ')}.</li>
                <li>Why those: {schoolName}'s cut order, cheapest to lose first: {f.cutOrder.join(' → ')}.</li>
                <li>Protected: {f.protected.join(', ') || 'no key sessions'}.</li>
                {#if f.stillOver > 0}
                    <li>Still {trimp(f.stillOver)} over: nothing else is in the cut order.</li>
                {/if}
                {#if f.fallbackShare > 0}
                    <li>{pct(f.fallbackShare)} of the planned load is a flat-rate estimate.</li>
                {/if}
            </ul>
        </details>
    {:else if f.offered}
        {@const offered = f.offered}
        {#if week.decision === 'PENDING'}
            <div class="gc-stat space-y-2" role="alert">
                <p class="text-sm text-slate-100">
                    This week is {trimp(f.overspend)} over budget: {trimp(f.plannedTotal)} planned against {trimp(
                        f.budget,
                    )}.
                </p>
                <ul class="ml-4 list-disc text-xs text-slate-400">
                    {#if f.removed.length > 0}
                        <li>
                            Removing {titles(f.removed)} ({schoolName}'s cut order: {f.cutOrder.join(' → ')}) is not
                            enough.
                        </li>
                    {:else}
                        <li>No easy volume is left to trim ({schoolName}'s cut order: {f.cutOrder.join(' → ')}).</li>
                    {/if}
                    <li>{offered.title} ({trimp(offered.plannedLoad)}) is a key session, so you decide.</li>
                    <li>Protected either way: {f.protected.join(', ') || 'no other key sessions'}.</li>
                    {#if f.fallbackShare > 0}
                        <li>{pct(f.fallbackShare)} of the planned load is a flat-rate estimate.</li>
                    {/if}
                </ul>
                <div class="flex flex-wrap gap-2">
                    {#each offered.options as option}
                        <button
                            type="button"
                            class={option === 'KEEP' ? 'gc-ghost' : 'gc-button'}
                            disabled={saving}
                            on:click={() => answer(option)}>
                            {OPTION_LABELS[option](offered.title)}
                        </button>
                    {/each}
                </div>
                {#if error}<p class="text-sm text-amber-300">{error}</p>{/if}
            </div>
        {:else if week.decision}
            <p class="text-sm text-slate-300">
                {ANSWERED[week.decision]}
                {offered.title} this week ({trimp(f.overspend)} over a budget of {trimp(f.budget)}).
            </p>
        {/if}
        {#if budget.schoolFit}
            <p class="text-sm text-amber-300" role="note">
                The key sessions alone cost more than this week's budget, so {schoolName}'s minimum week does not fit
                you now. Consider a gentler school, a longer horizon, or a lead-in phase.
                {#if keptWeeks > 0}
                    You kept {keptWeeks}
                    {keptWeeks === 1 ? 'week' : 'weeks'} over budget so far.
                {/if}
                <button type="button" class="underline" on:click={() => dispatch('recut')}>Change school</button>
            </p>
        {/if}
    {/if}
{/if}
