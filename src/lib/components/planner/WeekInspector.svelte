<script lang="ts">
    import { formatVolume, type PlanView } from '$lib/planner/plan-view';

    export let plan: PlanView;
    export let index: number;

    $: week = plan.weeks[index];
    $: phase = plan.phases.find((p) => p.ordinal === week.phaseOrdinal)!;
    $: fixtures = plan.fixtures.filter((f) => f.weekIndex === index);
    $: partial = week.inHorizonDays < 7;
    $: status =
        week.generation === 'GENERATED'
            ? 'Written'
            : week.generation === 'FAILED'
              ? 'Generation failed'
              : 'Not yet written';
</script>

<section class="gc-panel p-4 space-y-3" aria-label="Week {index + 1}">
    <header class="flex flex-wrap items-baseline justify-between gap-2">
        <h2 class="text-lg font-bold text-slate-100">
            Week {index + 1} <span class="text-slate-400 font-normal">of {plan.weeks.length}</span>
        </h2>
        <span
            class="text-xs uppercase tracking-widest {week.generation === 'FAILED' ? 'text-red-400' : 'text-sky-300'}">
            {status}
        </span>
    </header>
    <p class="text-sm text-slate-400">
        {week.startDate} – {week.endDate}{partial ? ` · ${week.inHorizonDays} days in the horizon` : ''}
    </p>

    <div>
        <div class="text-xs uppercase tracking-widest text-slate-500">Phase</div>
        <div class="font-semibold text-slate-100">{phase.name}{week.isCutback ? ' · cutback week' : ''}</div>
        <p class="text-sm text-slate-300">{phase.intent}</p>
    </div>

    <dl class="grid grid-cols-2 gap-3">
        <div class="gc-stat">
            <dt>Running volume</dt>
            <dd data-testid="volume-target">{formatVolume(week.volumeTarget, week.volumeUnit)}</dd>
        </div>
        <div class="gc-stat">
            <dt>Strength sessions</dt>
            <dd data-testid="strength-target">{week.strengthSessionTarget}</dd>
        </div>
    </dl>

    {#each fixtures as fixture}
        <p class="text-sm text-amber-300">⚑ Tune-up: {fixture.name ?? 'race'} on {fixture.date}</p>
    {/each}
</section>
