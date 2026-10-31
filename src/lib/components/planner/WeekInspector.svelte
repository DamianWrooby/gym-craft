<script lang="ts">
    import { m } from '$lib/paraglide/messages.js';
    import { createEventDispatcher } from 'svelte';
    import { ChevronLeftIcon, ChevronRightIcon } from 'svelte-feather-icons';
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
    import { displaySchool } from '$lib/i18n/school-text';

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
    $: school = plan.school.id ? displaySchool(getSchool(plan.school.id)) : null;
    let adding = false;
    const dispatch = createEventDispatcher<{ select: number }>();
    $: status =
        week.generation === 'GENERATED'
            ? m.inspector_written()
            : week.generation === 'FAILED'
              ? m.inspector_failed()
              : m.inspector_not_written();
</script>

<section class="gc-panel p-4 space-y-3" aria-label={m.timeline_week({ n: index + 1 })}>
    <header class="flex flex-wrap items-center justify-between gap-2">
        <div class="flex flex-wrap items-center gap-2">
            <button
                type="button"
                class="gc-ghost gc-week-nav"
                title={m.inspector_prev_week()}
                aria-label={m.inspector_prev_week()}
                disabled={index === 0}
                on:click={() => dispatch('select', index - 1)}><ChevronLeftIcon size="16" /></button>
            <h2 class="text-lg font-bold text-slate-100">
                {m.timeline_week({ n: index + 1 })}
                <span class="text-slate-400 font-normal">{m.inspector_of({ total: plan.weeks.length })}</span>
            </h2>
            <button
                type="button"
                class="gc-ghost gc-week-nav"
                title={m.inspector_next_week()}
                aria-label={m.inspector_next_week()}
                disabled={index === plan.weeks.length - 1}
                on:click={() => dispatch('select', index + 1)}><ChevronRightIcon size="16" /></button>
            {#if plan.currentWeekIndex != null && index !== plan.currentWeekIndex}
                <button
                    type="button"
                    class="gc-ghost gc-week-nav"
                    on:click={() => dispatch('select', plan.currentWeekIndex ?? 0)}>{m.inspector_this_week()}</button>
            {/if}
        </div>
        <span
            class="text-xs uppercase tracking-widest {week.generation === 'FAILED' ? 'text-red-400' : 'text-sky-300'}">
            {status}
        </span>
    </header>
    <p class="text-sm text-slate-400">
        {week.startDate} – {week.endDate}{partial ? ` · ${m.inspector_partial({ days: week.inHorizonDays })}` : ''}
    </p>

    <div>
        <div class="text-xs uppercase tracking-widest text-slate-500">{m.inspector_phase()}</div>
        <div class="font-semibold text-slate-100">
            {phase.name}{week.isCutback ? ` · ${m.inspector_cutback_week()}` : ''}{week.isTaper
                ? ` · ${m.inspector_taper_week()}`
                : ''}
        </div>
        <p class="text-sm text-slate-300">{phase.intent}</p>
    </div>

    <dl class="grid grid-cols-2 gap-3">
        <div class="gc-stat">
            <dt>{m.inspector_running_volume()}</dt>
            <dd data-testid="volume-target">{formatVolume(week.volumeTarget, week.volumeUnit)}</dd>
        </div>
        <div class="gc-stat">
            <dt>{m.inspector_strength_sessions()}</dt>
            <dd data-testid="strength-target">{week.strengthSessionTarget}</dd>
        </div>
    </dl>

    {#if week.timeTrialDistanceM}
        <p class="text-sm text-sky-300">
            ⏱ {m.inspector_time_trial({ km: week.timeTrialDistanceM / 1000 })}
        </p>
    {/if}
    {#if week.generation !== 'GENERATED'}
        {#each fixtures as fixture}
            <p class="text-sm text-amber-300">
                ⚑ {m.inspector_tune_up({ name: fixture.name ?? m.timeline_race(), date: fixture.date })}
            </p>
        {/each}
    {/if}

    <div class="grid gap-3 sm:grid-cols-2">
        <RecoveryBudgetBar {week} />
        {#if week.generation === 'GENERATED'}<SessionsDoneBar {week} />{/if}
        {#if adapt}<RevisionsLeftBar revisions={adapt.revisions} />{/if}
    </div>

    {#if week.generation === 'GENERATED'}
        <ConflictNote {week} schoolName={plan.school.name} {userId} keptWeeks={plan.keptWeeks} on:recut />
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
            <button type="button" class="gc-ghost" on:click={() => (adding = true)}>{m.form_add_session()}</button>
        {/if}
        <button type="button" class="gc-ghost" on:click={() => downloadWeekPdf(plan, index)}
            >{m.inspector_download_pdf()}</button>
    {:else}
        {#key week.id}<WeekGeneration {week} {userId} {proxySession} />{/key}
    {/if}
</section>

<style>
    .gc-week-nav {
        display: inline-flex;
        align-items: center;
        padding: 0.3rem 0.5rem;
        font-size: 0.7rem;
    }
    .gc-week-nav:hover:not(:disabled) {
        color: #f8fafc;
        border-color: #38bdf8;
        background-color: rgba(56, 189, 248, 0.15);
    }
    .gc-week-nav:disabled {
        opacity: 0.35;
        cursor: not-allowed;
    }
</style>
