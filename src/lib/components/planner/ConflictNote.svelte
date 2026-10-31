<script lang="ts">
    import { m } from '$lib/paraglide/messages.js';
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
        DROP: (title) => m.conflict_option_drop({ title }),
        DOWNGRADE: (title) => m.conflict_option_downgrade({ title }),
        KEEP: () => m.conflict_option_keep(),
        REWRITE: () => m.conflict_option_rewrite(),
    };
    const ANSWERED: Record<string, (p: { title: string; over: string; budget: string }) => string> = {
        DROPPED: m.conflict_answered_dropped,
        DOWNGRADED: m.conflict_answered_downgraded,
        KEPT: m.conflict_answered_kept,
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
            {m.conflict_not_fit({ title: asked.title })}
        </p>
        <ul class="ml-4 list-disc text-xs text-slate-400">
            <li>{m.conflict_rules_broke({ rules: placement.violations.join('; ') })}</li>
            {#if placement.removed.length}
                <li>
                    {m.conflict_also_removed({
                        sessions: placement.removed.map((r) => `${r.title} (${trimp(r.plannedLoad)})`).join(', '),
                    })}
                </li>
            {/if}
            <li>{m.conflict_key_you_decide({ title: asked.title, load: trimp(asked.plannedLoad) })}</li>
            <li>{m.conflict_protected({ sessions: placement.protected.join(', ') || m.conflict_no_other_key() })}</li>
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
    <p class="text-sm text-slate-300">{m.conflict_dropped_to_fit({ title: asked.title })}</p>
{:else if placement && placement.removed.length > 0}
    <details class="text-sm text-slate-300">
        <summary>{m.conflict_removed_to_fit({ sessions: titles(placement.removed) })}</summary>
        <ul class="mt-1 ml-4 list-disc text-xs text-slate-400">
            <li>{m.conflict_rules_broke({ rules: placement.violations.join('; ') })}</li>
            <li>
                {m.conflict_removed({
                    sessions: placement.removed.map((r) => `${r.title} (${trimp(r.plannedLoad)})`).join(', '),
                })}
            </li>
            <li>{m.conflict_why_those({ school: schoolName, order: placement.cutOrder.join(' → ') })}</li>
            <li>{m.conflict_protected({ sessions: placement.protected.join(', ') || m.conflict_no_key() })}</li>
        </ul>
    </details>
{/if}

{#if budget}
    {@const f = budget.facts}
    {#if budget.kind === 'TRIM'}
        <details class="text-sm text-slate-300">
            <summary>
                {#if f.removed.length === 0}
                    {m.conflict_nothing_trimmed({ over: trimp(f.stillOver) })}
                {:else if f.stillOver > 0}
                    {m.conflict_trimmed_still_over({ sessions: titles(f.removed), over: trimp(f.stillOver) })}
                {:else}
                    {m.conflict_trimmed_to_fit({ sessions: titles(f.removed) })}
                {/if}
            </summary>
            <ul class="mt-1 ml-4 list-disc text-xs text-slate-400">
                <li>
                    {m.conflict_planned_vs_budget({
                        planned: trimp(f.plannedTotal),
                        budget: trimp(f.budget),
                        over: trimp(f.overspend),
                    })}
                </li>
                <li>
                    {m.conflict_removed({
                        sessions: f.removed.map((r) => `${r.title} (${trimp(r.plannedLoad)})`).join(', '),
                    })}
                </li>
                <li>{m.conflict_why_those({ school: schoolName, order: f.cutOrder.join(' → ') })}</li>
                <li>{m.conflict_protected({ sessions: f.protected.join(', ') || m.conflict_no_key() })}</li>
                {#if f.stillOver > 0}
                    <li>{m.conflict_still_over({ over: trimp(f.stillOver) })}</li>
                {/if}
                {#if f.fallbackShare > 0}
                    <li>{m.conflict_fallback({ share: pct(f.fallbackShare) })}</li>
                {/if}
            </ul>
        </details>
    {:else if f.offered}
        {@const offered = f.offered}
        {#if week.decision === 'PENDING'}
            <div class="gc-stat space-y-2" role="alert">
                <p class="text-sm text-slate-100">
                    {m.conflict_week_over({
                        over: trimp(f.overspend),
                        planned: trimp(f.plannedTotal),
                        budget: trimp(f.budget),
                    })}
                </p>
                <ul class="ml-4 list-disc text-xs text-slate-400">
                    {#if f.removed.length > 0}
                        <li>
                            {m.conflict_removing_not_enough({
                                sessions: titles(f.removed),
                                school: schoolName,
                                order: f.cutOrder.join(' → '),
                            })}
                        </li>
                    {:else}
                        <li>{m.conflict_no_easy_volume({ school: schoolName, order: f.cutOrder.join(' → ') })}</li>
                    {/if}
                    <li>{m.conflict_key_you_decide({ title: offered.title, load: trimp(offered.plannedLoad) })}</li>
                    <li>
                        {m.conflict_protected_either_way({
                            sessions: f.protected.join(', ') || m.conflict_no_other_key(),
                        })}
                    </li>
                    {#if f.fallbackShare > 0}
                        <li>{m.conflict_fallback({ share: pct(f.fallbackShare) })}</li>
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
                {ANSWERED[week.decision]?.({ title: offered.title, over: trimp(f.overspend), budget: trimp(f.budget) })}
            </p>
        {/if}
        {#if budget.schoolFit}
            <p class="text-sm text-amber-300" role="note">
                {m.conflict_school_fit({ school: schoolName })}
                {#if keptWeeks > 0}
                    {m.conflict_kept_weeks({ weeks: keptWeeks })}
                {/if}
                <button type="button" class="underline" on:click={() => dispatch('recut')}
                    >{m.recut_change_school()}</button>
            </p>
        {/if}
    {/if}
{/if}
