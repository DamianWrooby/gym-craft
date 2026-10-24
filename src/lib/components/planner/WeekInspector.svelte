<script lang="ts">
    import { formatVolume, type PlanView, type PlanViewActivity } from '$lib/planner/plan-view';
    import { downloadWeekPdf } from '$lib/utils/plan-description';
    import WeekCalendar from './WeekCalendar.svelte';
    import WeekGeneration from './WeekGeneration.svelte';
    import RecoveryBudgetBar from './RecoveryBudgetBar.svelte';
    import SessionsDoneBar from './SessionsDoneBar.svelte';
    import RevisionsLeftBar from './RevisionsLeftBar.svelte';
    import RevisionPanel from './RevisionPanel.svelte';
    import type { AdaptView } from '$lib/planner/adapt-view';
    import ConflictNote from './ConflictNote.svelte';
    import SessionForm from './SessionForm.svelte';
    import { getSchool } from '$lib/planner/schools/catalogue';

    export let plan: PlanView;
    export let index: number;
    export let userId: string;
    export let proxySession: string | null;
    /** The current week's synced activities; null on other weeks, where links are fixed. */
    export let activities: PlanViewActivity[] | null = null;
    /** The current week's revision state; null on other weeks, which revisions never touch. */
    export let adapt: AdaptView | null = null;

    $: week = plan.weeks[index];
    $: phase = plan.phases.find((p) => p.ordinal === week.phaseOrdinal)!;
    $: fixtures = plan.fixtures.filter((f) => f.weekIndex === index);
    $: partial = week.inHorizonDays < 7;
    $: school = plan.school.id ? getSchool(plan.school.id) : null;
    let adding = false;
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
        <div class="font-semibold text-slate-100">
            {phase.name}{week.isCutback ? ' · cutback week' : ''}{week.isTaper ? ' · taper week' : ''}
        </div>
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

    {#if week.timeTrialDistanceM}
        <p class="text-sm text-sky-300">
            ⏱ Time trial: {week.timeTrialDistanceM / 1000} km this week. Enter the result to anchor your paces.
        </p>
    {/if}
    {#if week.generation !== 'GENERATED'}
        {#each fixtures as fixture}
            <p class="text-sm text-amber-300">⚑ Tune-up: {fixture.name ?? 'race'} on {fixture.date}</p>
        {/each}
    {/if}

    <div class="grid gap-3 sm:grid-cols-2">
        <RecoveryBudgetBar {week} />
        {#if week.generation === 'GENERATED'}<SessionsDoneBar {week} />{/if}
        {#if adapt}<RevisionsLeftBar revisions={adapt.revisions} />{/if}
    </div>

    {#if week.generation === 'GENERATED'}
        <ConflictNote
            {week}
            schoolName={plan.school.name}
            {userId}
            keptWeeks={plan.weeks.filter((w) => w.decision === 'KEPT').length}
            on:recut />
        {#if adapt?.revision}
            {#key adapt.revision.request?.id}
                <RevisionPanel
                    revision={adapt.revision}
                    superseded={adapt.superseded}
                    revisions={adapt.revisions}
                    {userId}
                    {proxySession} />
            {/key}
        {/if}
        <WeekCalendar {week} {fixtures} schoolId={plan.school.id} actions={{ userId, school, activities }} />
        {#if adding}
            {#key week.id}<SessionForm {userId} {week} {school} on:close={() => (adding = false)} />{/key}
        {:else}
            <button type="button" class="gc-ghost" on:click={() => (adding = true)}>Add session</button>
        {/if}
        <button type="button" class="gc-ghost" on:click={() => downloadWeekPdf(plan, index)}
            >Download week as PDF</button>
    {:else}
        {#key week.id}<WeekGeneration {week} {userId} {proxySession} />{/key}
    {/if}
</section>
