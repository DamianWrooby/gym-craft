<script lang="ts">
    // One recovery budget for running and strength together (ADR 0011); never split by kind.
    import { budgetBarState, type PlanViewWeek } from '$lib/planner/plan-view';

    export let week: Pick<PlanViewWeek, 'budget' | 'sessions' | 'decision'>;

    $: state = budgetBarState(week);
    const pct = (share: number) => `${Math.round(share * 100)}%`;
    const trimp = (n: number) => `${Math.round(n)}`;
</script>

<div class="gc-stat space-y-1">
    <div class="text-xs uppercase tracking-widest text-slate-500">Recovery budget</div>
    {#if state.kind === 'unstruck'}
        <p class="text-sm text-slate-400">Struck when this week is written.</p>
    {:else if state.kind === 'needs-tracked-activity'}
        <p class="text-sm text-slate-400">
            <span aria-hidden="true">🔒</span> Needs tracked activity. Link Garmin to strike a budget; the plan works without
            it.
        </p>
    {:else if state.kind === 'needs-tracked-training'}
        <p class="text-sm text-slate-400">
            <span aria-hidden="true">🔒</span> Needs 28 days of tracked training before a budget can be struck.
        </p>
    {:else}
        {@const over = state.kind === 'over'}
        <div
            role="meter"
            aria-label="Recovery budget"
            aria-valuemin={0}
            aria-valuemax={state.budget}
            aria-valuenow={state.evaluation.plannedTotal}
            class="gc-bar {over ? 'gc-over' : ''}">
            <div
                class="gc-bar-fill"
                style="width: {Math.min(100, (state.evaluation.plannedTotal / state.budget) * 100)}%" />
        </div>
        <div class="flex flex-wrap justify-between gap-2 text-sm">
            <span class={over ? 'text-red-400 font-semibold' : 'text-slate-200'}
                >{trimp(state.evaluation.plannedTotal)} of {trimp(state.budget)} TRIMP</span>
            {#if over}
                <span class="text-red-400">Over budget by {trimp(-(state.evaluation.remainder ?? 0))} TRIMP</span>
            {/if}
        </div>
        {#if over && state.kept}
            <p class="text-xs text-amber-300">You kept this week over budget. It applies to this week only.</p>
        {/if}
        {#if state.chronicLoad != null}
            <p class="text-xs text-slate-400">
                1.3 × your chronic load of {state.chronicLoad} TRIMP/day, struck when the week was written.
            </p>
        {/if}
        <p class="text-xs text-slate-400">
            {pct(state.evaluation.fallbackShare)} of this week's planned load is a flat-rate estimate{#if state.chronicFallbackShare != null};
                {pct(state.chronicFallbackShare)} of your chronic load is{/if}.
        </p>
    {/if}
</div>

<style>
    .gc-bar {
        height: 0.5rem;
        background: rgba(148, 163, 184, 0.2);
        overflow: hidden;
    }
    .gc-bar-fill {
        height: 100%;
        background: #38bdf8;
    }
    .gc-over .gc-bar-fill {
        background: #ef4444;
    }
    .gc-over {
        animation: gc-shake 400ms ease-in-out 2;
    }
    @keyframes gc-shake {
        0%,
        100% {
            transform: translateX(0);
        }
        25% {
            transform: translateX(-4px);
        }
        75% {
            transform: translateX(4px);
        }
    }
    @media (prefers-reduced-motion: reduce) {
        .gc-over {
            animation: none;
        }
    }
</style>
