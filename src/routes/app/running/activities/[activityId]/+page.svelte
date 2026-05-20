<script lang="ts">
    import { goto } from '$app/navigation';
    import { page } from '$app/stores';
    import { ArrowLeftIcon } from 'svelte-feather-icons';
    import Card from '@components/card/Card.svelte';
    import Seo from '$lib/components/seo/Seo.svelte';
    import ActivityTypeIcon from '$lib/components/activity-type-icon/ActivityTypeIcon.svelte';
    import SplitsTable from '$lib/components/activity-detail/SplitsTable.svelte';
    import HrPaceOverlayChart from '$lib/components/activity-detail/HrPaceOverlayChart.svelte';
    import AskAiPanel from '$lib/components/activity-detail/AskAiPanel.svelte';
    import StatCard from '$lib/components/stat-card/StatCard.svelte';
    import { formatPaceOrSpeed } from '$lib/utils/pace';
    import type { User } from '@/models/user/user.model';

    export let data;

    const user: User = $page.data.user;
    const activity = data.activity;

    function formatDate(iso: string): string {
        return new Date(iso).toLocaleString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    }

    function formatDistance(meters: number | null): string {
        if (!meters) return '—';
        return `${(meters / 1000).toFixed(2)} km`;
    }

    function formatDuration(sec: number | null): string {
        if (!sec) return '—';
        const h = Math.floor(sec / 3600);
        const m = Math.floor((sec % 3600) / 60);
        const s = Math.floor(sec % 60);
        if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        return `${m}:${s.toString().padStart(2, '0')}`;
    }

    function formatType(type: string): string {
        return type.replace(/_/g, ' ').toUpperCase();
    }
</script>

<Seo title="{activity.activityName ?? 'Activity'} | GymCraft™" metaDescription="Activity detail with splits and AI analysis." />

<Card width="3/4">
    <div class="flex justify-between items-center pb-4">
        <button type="button" on:click={() => goto('/app/running/analytics')} aria-label="Back to activities">
            <ArrowLeftIcon class="cursor-pointer text-surface-400 hover:text-surface-300" />
        </button>
    </div>

    <header class="mb-8">
        <div class="flex items-center gap-3 mb-2">
            <ActivityTypeIcon typeKey={activity.activityType} size={28} />
            <h1 class="h2 text-xl font-bold m-0">{activity.activityName ?? formatType(activity.activityType)}</h1>
        </div>
        <p class="text-sm opacity-70">{formatDate(activity.startTime)} · {formatType(activity.activityType)}</p>
    </header>

    <section class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-10">
        <StatCard label="Distance" value={formatDistance(activity.distanceM)} />
        <StatCard label="Duration" value={formatDuration(activity.durationSec)} />
        <StatCard label="Avg pace / speed" value={formatPaceOrSpeed(activity.averageSpeed, activity.activityType)} />
        <StatCard label="Avg HR" value={activity.averageHr != null ? `${activity.averageHr} bpm` : '—'} />
    </section>

    {#if activity.detail}
        <section class="mb-10">
            <h2 class="h3 font-semibold mb-3">HR & pace over time</h2>
            <HrPaceOverlayChart samples={activity.detail.samples} />
        </section>

        <section class="mb-10">
            <h2 class="h3 font-semibold mb-3">Splits</h2>
            <SplitsTable splits={activity.detail.splits} activityType={activity.activityType} />
        </section>
    {:else}
        <aside class="card variant-soft-surface p-4 mb-10">
            <p class="text-sm opacity-80">
                Detailed splits and time-series for this activity haven't been fetched yet. Ask the coach below and
                we'll pull them on demand.
            </p>
        </aside>
    {/if}

    <section class="mb-6">
        <AskAiPanel userId={user.id} activityDbId={activity.id} />
    </section>
</Card>
