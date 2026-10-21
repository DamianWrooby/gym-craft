<script lang="ts">
    import PlannerShell from '$lib/components/planner/PlannerShell.svelte';
    import PlanHeader from '$lib/components/planner/PlanHeader.svelte';
    import PhaseTimeline from '$lib/components/planner/PhaseTimeline.svelte';
    import WeekInspector from '$lib/components/planner/WeekInspector.svelte';
    import PlanRationale from '$lib/components/planner/PlanRationale.svelte';
    import PullPrompt from '$lib/components/planner/PullPrompt.svelte';
    import { page } from '$app/stores';
    import type { PlanView, PlanViewActivity } from '$lib/planner/plan-view';

    export let data: { plan: PlanView | null; proxySession: string | null; activities: PlanViewActivity[] };

    let selected: number | null = null;
    $: plan = data.plan;
    $: shown = plan ? (selected ?? plan.currentWeekIndex ?? 0) : null;
</script>

<svelte:head><title>Plan | GymCraft</title></svelte:head>

<PlannerShell>
    {#if plan && shown != null}
        <PlanHeader {plan} />
        {#if plan.rationale}<PlanRationale rationale={plan.rationale} />{/if}
        <PhaseTimeline {plan} selected={shown} on:select={(e) => (selected = e.detail)} />
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
            activities={shown === plan.currentWeekIndex ? data.activities : null} />
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
