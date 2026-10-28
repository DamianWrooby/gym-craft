<script lang="ts">
    import { m } from '$lib/paraglide/messages.js';
    import PlannerShell from '$lib/components/planner/PlannerShell.svelte';
    import PlanHeader from '$lib/components/planner/PlanHeader.svelte';
    import PhaseTimeline from '$lib/components/planner/PhaseTimeline.svelte';
    import WeekInspector from '$lib/components/planner/WeekInspector.svelte';
    import PlanRationale from '$lib/components/planner/PlanRationale.svelte';
    import PullPrompt from '$lib/components/planner/PullPrompt.svelte';
    import CheckInCard from '$lib/components/planner/CheckInCard.svelte';
    import RecutSuggestion from '$lib/components/planner/RecutSuggestion.svelte';
    import RecutPanel from '$lib/components/planner/RecutPanel.svelte';
    import StartOverPanel from '$lib/components/planner/StartOverPanel.svelte';
    import { page } from '$app/stores';
    import type { PlanView, PlanViewActivity } from '$lib/planner/plan-view';
    import type { AdaptView } from '$lib/planner/adapt-view';

    export let data: {
        plan: PlanView | null;
        proxySession: string | null;
        activities: PlanViewActivity[];
        adapt: AdaptView | null;
    };

    let selected: number | null = null;
    let recutOpen = false;
    $: plan = data.plan;
    $: shown = plan ? (selected ?? plan.currentWeekIndex ?? 0) : null;
    $: adapt = data.adapt;
    $: onCurrent = plan != null && shown === plan.currentWeekIndex;

    function selectWeek(index: number) {
        if (plan && index >= 0 && index < plan.weeks.length) selected = index;
    }

    // Arrow keys move between weeks, unless the athlete is typing in a field.
    function onKeydown(e: KeyboardEvent) {
        if (shown == null || e.altKey || e.ctrlKey || e.metaKey) return;
        const target = e.target as HTMLElement | null;
        if (target?.closest('input, select, textarea, [contenteditable="true"]')) return;
        if (e.key === 'ArrowLeft') selectWeek(shown - 1);
        else if (e.key === 'ArrowRight') selectWeek(shown + 1);
    }
</script>

<svelte:window on:keydown={onKeydown} />

<svelte:head><title>{m.nav_plan()} | GymCraft</title></svelte:head>

<PlannerShell wide>
    {#if plan && shown != null}
        <PlanHeader {plan} />
        {#if plan.rationale}<PlanRationale rationale={plan.rationale} />{/if}
        <PhaseTimeline {plan} selected={shown} on:select={(e) => (selected = e.detail)} />
        {#if adapt?.recut.shown}
            <RecutSuggestion
                driftWeeks={adapt.recut.driftWeeks}
                userId={$page.data.user.id}
                on:recut={() => (recutOpen = true)} />
        {/if}
        <RecutPanel
            userId={$page.data.user.id}
            endDate={plan.endDate}
            schoolId={plan.school.id}
            bind:open={recutOpen} />
        <StartOverPanel userId={$page.data.user.id} revisions={adapt?.revisions ?? null} />
        {#if adapt?.revision && onCurrent}
            <CheckInCard
                checkIn={adapt.checkIn}
                userId={$page.data.user.id}
                revisionPending={adapt.revision.generation === 'PENDING'} />
        {/if}
        {#if plan.pull && shown === plan.currentWeekIndex}
            {#key plan.pull.weekIndex}
                <PullPrompt {plan} userId={$page.data.user.id} proxySession={data.proxySession} />
            {/key}
        {/if}
        <WeekInspector
            {plan}
            index={shown}
            userId={$page.data.user.id}
            proxySession={data.proxySession}
            activities={onCurrent ? data.activities : null}
            adapt={onCurrent ? adapt : null}
            on:recut={() => (recutOpen = true)}
            on:select={(e) => selectWeek(e.detail)} />
    {:else}
        <section class="gc-panel p-8 text-center space-y-4">
            <h1 class="text-3xl font-black tracking-wide">{m.plan_build_heading()}</h1>
            <p class="text-slate-300 max-w-prose mx-auto">
                {m.plan_build_intro()}
            </p>
            <a class="gc-button inline-block" href="/app/plan/setup">{m.plan_start_setup()}</a>
        </section>
    {/if}
</PlannerShell>
