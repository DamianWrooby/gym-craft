<script lang="ts">
    import { m } from '$lib/paraglide/messages.js';
    import InfoTooltip from '$lib/components/info-tooltip/InfoTooltip.svelte';
    // One recovery budget for running and strength together (ADR 0011); never split by kind.
    import { budgetBarState, type PlanViewWeek } from '$lib/planner/plan-view';

    export let week: Pick<PlanViewWeek, 'budget' | 'sessions' | 'decision'>;

    $: state = budgetBarState(week);
    const pct = (share: number) => `${Math.round(share * 100)}%`;
    const trimp = (n: number) => `${Math.round(n)}`;
</script>

<div class="gc-stat space-y-1">
    <div class="flex items-center gap-1 text-xs uppercase tracking-widest text-slate-500">
        {m.budget_heading()}
        <InfoTooltip id="tip-budget" ariaLabel={m.help_aria()} placement="top">{m.help_budget()}</InfoTooltip>
    </div>
    {#if state.kind === 'unstruck'}
        <p class="text-sm text-slate-400">{m.budget_unstruck()}</p>
    {:else if state.kind === 'needs-tracked-activity'}
        <p class="text-sm text-slate-400">
            <span aria-hidden="true">🔒</span>
            {m.budget_needs_activity()}
        </p>
    {:else if state.kind === 'needs-tracked-training'}
        <p class="text-sm text-slate-400">
            <span aria-hidden="true">🔒</span>
            {m.budget_needs_training()}
        </p>
    {:else}
        {@const over = state.kind === 'over'}
        <div
            role="meter"
            aria-label={m.budget_heading()}
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
                >{m.budget_of({ planned: trimp(state.evaluation.plannedTotal), budget: trimp(state.budget) })}</span>
            {#if over}
                <span class="text-red-400"
                    >{m.budget_over_by({ amount: trimp(-(state.evaluation.remainder ?? 0)) })}</span>
            {/if}
        </div>
        {#if over && state.kept}
            <p class="text-xs text-amber-300">{m.budget_kept()}</p>
        {/if}
        {#if state.chronicLoad != null}
            <p class="text-xs text-slate-400">
                {m.budget_basis({ chronic: state.chronicLoad })}
            </p>
        {/if}
        <p class="text-xs text-slate-400">
            {#if state.chronicFallbackShare != null}
                {m.budget_fallback_both({
                    planned: pct(state.evaluation.fallbackShare),
                    chronic: pct(state.chronicFallbackShare),
                })}
            {:else}
                {m.budget_fallback({ planned: pct(state.evaluation.fallbackShare) })}
            {/if}
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
