<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import type { PlanView } from '$lib/planner/plan-view';

    export let plan: PlanView;
    export let selected: number | null = null;

    const dispatch = createEventDispatcher<{ select: number }>();

    // Lead-in in grey (GymCraft's phase); school phases alternate crimson and blue.
    const phaseColor = (source: string, ordinal: number) =>
        source === 'LEAD_IN' ? 'bg-slate-500' : ordinal % 2 === 0 ? 'bg-rose-600' : 'bg-sky-600';

    $: fixtureWeeks = new Map(plan.fixtures.map((f) => [f.weekIndex, f]));
</script>

<section class="gc-panel p-4 space-y-3" aria-label="Phase timeline">
    <div class="flex justify-between text-[11px] uppercase tracking-[0.2em] text-slate-400">
        <span>{plan.startDate}</span>
        <span>Horizon · {plan.weeks.length} weeks</span>
        <span>{plan.endDate}</span>
    </div>

    <div class="flex gap-1 overflow-x-auto pb-6">
        {#each plan.phases as phase}
            <div style="flex: {phase.weekIndexes.length} 0 0" class="min-w-[2.5rem]">
                <div class="text-[11px] font-bold truncate mb-1 text-slate-200" title={phase.intent}>
                    {phase.name}
                </div>
                <div class="flex gap-0.5 items-end h-8">
                    {#each phase.weekIndexes as index}
                        {@const week = plan.weeks[index]}
                        {@const fixture = fixtureWeeks.get(index)}
                        <button
                            type="button"
                            data-testid="week-{index}"
                            data-generation={week.generation}
                            on:click={() => dispatch('select', index)}
                            class="relative flex-1 min-w-[0.6rem] rounded-sm transition hover:-translate-y-0.5
                                {week.isCutback ? 'h-5' : 'h-8'}
                                {week.generation === 'FAILED'
                                ? 'bg-red-500 animate-pulse'
                                : phaseColor(phase.source, phase.ordinal)}
                                {week.generation === 'PENDING' ? 'opacity-35 border border-dashed border-white/40' : ''}
                                {selected === index ? 'ring-2 ring-sky-300' : ''}"
                            aria-label="Week {index + 1}{week.isCutback ? ', cutback' : ''}{week.generation ===
                            'PENDING'
                                ? ', not yet written'
                                : week.generation === 'FAILED'
                                  ? ', failed'
                                  : ', written'}{fixture ? `, tune-up: ${fixture.name ?? 'race'}` : ''}">
                            {#if fixture}
                                <span class="absolute -top-3 left-1/2 -translate-x-1/2 text-[10px]" aria-hidden="true"
                                    >⚑</span>
                            {/if}
                            {#if index === plan.currentWeekIndex}
                                <span
                                    class="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[10px] font-bold text-sky-300 whitespace-nowrap"
                                    >▲ now</span>
                            {/if}
                        </button>
                    {/each}
                </div>
            </div>
        {/each}
    </div>

    <div class="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-400">
        <span><span class="inline-block w-2 h-2 bg-rose-600 mr-1" />written</span>
        <span><span class="inline-block w-2 h-2 bg-rose-600 opacity-35 mr-1" />not yet written</span>
        <span><span class="inline-block w-2 h-2 bg-red-500 mr-1" />failed</span>
        <span>▁ cutback</span>
        <span>⚑ tune-up</span>
    </div>
</section>
