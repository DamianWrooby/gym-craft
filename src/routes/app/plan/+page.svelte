<script lang="ts">
    import PlannerShell from '$lib/components/planner/PlannerShell.svelte';
    import PlanHeader from '$lib/components/planner/PlanHeader.svelte';
    import PhaseTimeline from '$lib/components/planner/PhaseTimeline.svelte';
    import WeekInspector from '$lib/components/planner/WeekInspector.svelte';
    import PlanRationale from '$lib/components/planner/PlanRationale.svelte';
    import PullPrompt from '$lib/components/planner/PullPrompt.svelte';
    import CheckInCard from '$lib/components/planner/CheckInCard.svelte';
    import RecutSuggestion from '$lib/components/planner/RecutSuggestion.svelte';
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
    $: plan = data.plan;
    $: shown = plan ? (selected ?? plan.currentWeekIndex ?? 0) : null;
    $: adapt = data.adapt;
    $: onCurrent = plan != null && shown === plan.currentWeekIndex;
</script>

<svelte:head><title>Plan | GymCraft</title></svelte:head>

<PlannerShell>
    {#if plan && shown != null}
        <PlanHeader {plan} />
        {#if plan.rationale}<PlanRationale rationale={plan.rationale} />{/if}
        <PhaseTimeline {plan} selected={shown} on:select={(e) => (selected = e.detail)} />
        {#if adapt?.recut.shown}
            <RecutSuggestion driftWeeks={adapt.recut.driftWeeks} userId={$page.data.user.id} />
        {/if}
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
            adapt={onCurrent ? adapt : null} />
    {:else}
        <section class="gc-panel p-8 text-center space-y-4">
            <h1 class="text-3xl font-black tracking-wide">Build your plan</h1>
            <p class="text-slate-300 max-w-prose mx-auto">
                Pick a goal and a training school. GymCraft lays out every week from today to race day.
            </p>
            <a class="gc-button inline-block" href="/app/plan/setup">Start setup</a>
        </section>
    {/if}
</PlannerShell>
