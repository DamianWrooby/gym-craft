<script lang="ts">
    import { page } from '$app/stores';
    import { goto } from '$app/navigation';
    import { ArrowLeftIcon } from 'svelte-feather-icons';
    import Card from '@components/card/Card.svelte';
    import Seo from '$lib/components/seo/Seo.svelte';
    import Markdown from '$lib/components/markdown/Markdown.svelte';
    import DailyVolumeChart from '$lib/components/training-report/DailyVolumeChart.svelte';
    import HrZoneDonut from '$lib/components/training-report/HrZoneDonut.svelte';
    import PaceHrScatter from '$lib/components/training-report/PaceHrScatter.svelte';
    import StatDeltas from '$lib/components/training-report/StatDeltas.svelte';
    import TrainingLoadCard from '$lib/components/training-report/TrainingLoadCard.svelte';
    import RecommendationsPanel from '$lib/components/training-report/RecommendationsPanel.svelte';
    import { splitRecommendations } from '$lib/utils/split-recommendations';
    import { GOAL_TYPE_LABELS } from '@/constants/training-report.constants';
    import type { MetricsBundle } from '$lib/server/analytics/types';
    import type { GoalType } from '@prisma/client';

    type ReportGoalSnapshot = {
        id: string;
        goalType: GoalType;
        targetEventName: string | null;
        targetEventDate: string | null;
        targetDistanceM: number | null;
        targetTimeSec: number | null;
        priority: number;
        notes: string | null;
    };

    type GoalContext = {
        notes: string | null;
        goals: ReportGoalSnapshot[];
    };

    const report = $page.data.report as {
        id: string;
        periodStart: string;
        periodEnd: string;
        summary: string;
        metrics: MetricsBundle;
        goalContext: GoalContext;
        createdAt: string;
    };

    function formatPeriod(start: string, end: string): string {
        const fmt = (s: string) =>
            new Date(`${s}T00:00:00Z`).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                timeZone: 'UTC',
            });
        return `${fmt(start)} – ${fmt(end)}`;
    }
</script>

<Seo title="Weekly report | GymCraft™" metaDescription="Coach-style weekly training review." />

<Card width="3/4">
    <div class="flex justify-between items-center pb-4">
        <button type="button" on:click={() => goto('/app/running/analytics/reports')} aria-label="Back to reports">
            <ArrowLeftIcon class="cursor-pointer text-surface-400 hover:text-surface-300" />
        </button>
        <p class="text-xs opacity-60">Generated {new Date(report.createdAt).toLocaleString('en-US')}</p>
    </div>

    <header class="mb-10">
        <h1 class="h2 text-xl font-bold">Week of {formatPeriod(report.periodStart, report.periodEnd)}</h1>
        {#if report.goalContext.goals.length > 0}
            <div class="flex flex-wrap gap-2 mt-2">
                {#each report.goalContext.goals as goal (goal.id)}
                    <span class="chip variant-soft-primary">
                        {GOAL_TYPE_LABELS[goal.goalType]}{goal.targetEventName ? ` — ${goal.targetEventName}` : ''}
                    </span>
                {/each}
            </div>
        {/if}
        {#if report.goalContext.notes}
            <p class="text-sm opacity-80 mt-2">Notes: {report.goalContext.notes}</p>
        {/if}
    </header>

    {#if report.metrics.loadProfile}
        <section class="mb-10">
            <TrainingLoadCard loadProfile={report.metrics.loadProfile} />
        </section>
    {/if}

    {#if report.metrics.flags.noActivities}
        <p class="text-center italic opacity-70 my-8">No activities were recorded for this period.</p>
    {:else}
        {#if report.metrics.flags.noRunningActivities}
            <p class="italic opacity-70 mb-10">
                No running sessions were recorded this week. Charts below are for running only; the coach review still
                reflects any cross-training in this period.
            </p>
        {:else}
            {#if report.metrics.deltas}
                <section class="mb-16">
                    <h2 class="h3 font-semibold mb-4">Week over week</h2>
                    <StatDeltas deltas={report.metrics.deltas} />
                </section>
            {/if}

            <section class="mb-16">
                <h2 class="h3 font-semibold mb-4">Daily volume</h2>
                <DailyVolumeChart byDay={report.metrics.volume.byDay} />
            </section>

            {#if !report.metrics.flags.missingHRZones && report.metrics.intensity.hrZoneSeconds}
                <section class="mb-16">
                    <h2 class="h3 font-semibold mb-4">Heart rate zone distribution</h2>
                    <HrZoneDonut
                        hrZoneSeconds={report.metrics.intensity.hrZoneSeconds}
                        hrZonePercents={report.metrics.intensity.hrZonePercents} />
                </section>
            {/if}

            <section class="mb-16">
                <h2 class="h3 font-semibold mb-4">Pace vs HR</h2>
                <PaceHrScatter efficiency={report.metrics.efficiency} />
            </section>
        {/if}

        {@const split = splitRecommendations(report.summary)}
        <section class="mb-10">
            <h2 class="h3 font-semibold mb-4">Coach review</h2>
            <Markdown source={split.review} />
        </section>

        {#if split.recommendations}
            <section class="mb-16">
                <RecommendationsPanel source={split.recommendations} />
            </section>
        {/if}
    {/if}
</Card>
