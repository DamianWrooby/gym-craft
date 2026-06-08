<script lang="ts">
    import ActivityTypeIcon from '$lib/components/activity-type-icon/ActivityTypeIcon.svelte';
    import { PACE_ACTIVITY_TYPES, formatPaceOrSpeed } from '$lib/utils/pace';
    import type { ActivityListItem } from '$lib/server/garmin/activity-row-mapper';

    export let activity: ActivityListItem;

    function formatDistance(meters: number | null): string {
        if (!meters) return '—';
        return `${(meters / 1000).toFixed(2)} km`;
    }
    function formatDuration(seconds: number | null): string {
        if (!seconds) return '—';
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        return `${m}:${s.toString().padStart(2, '0')}`;
    }
    function formatElevation(meters: number | null): string {
        if (meters === undefined || meters === null) return '—';
        return `${Math.round(meters)} m`;
    }
    function formatHr(bpm: number | null): string {
        if (!bpm) return '—';
        return `${Math.round(bpm)} bpm`;
    }
    function formatCalories(kcal: number | null): string {
        if (!kcal) return '—';
        return `${Math.round(kcal)}`;
    }
    function formatActivityDate(iso: string): { month: string; day: string; year: string } {
        const d = new Date(iso);
        return {
            month: d.toLocaleString('en-US', { month: 'short' }),
            day: d.getDate().toString(),
            year: d.getFullYear().toString(),
        };
    }
    function formatActivityType(typeKey: string): string {
        return typeKey.replace(/_/g, ' ').toUpperCase();
    }

    $: date = formatActivityDate(activity.startTime);
</script>

<li
    class="group !m-0 text-surface-500 dark:text-tertiary-500 border-b-1 first:rounded-t-2xl last:rounded-b-2xl rounded-none odd:bg-surface-200 dark:odd:bg-surface-900 even:bg-surface-300 dark:even:bg-surface-800 hover:bg-white dark:hover:bg-surface-600">
    <a
        href="/app/running/analytics/activities/{activity.garminActivityId}"
        data-sveltekit-preload-data="hover"
        class="block px-4 py-3 no-underline text-inherit">
        <div class="flex flex-row items-center gap-3 flex-wrap">
            <div class="flex flex-row items-center gap-2 w-28 shrink-0">
                <ActivityTypeIcon typeKey={activity.activityType} size={22} />
                <div class="flex flex-col leading-tight">
                    <span class="font-semibold">{date.month} {date.day}</span>
                    <span class="text-xs opacity-70">{date.year}</span>
                </div>
            </div>
            <div class="flex flex-col leading-tight flex-1 min-w-[10rem]">
                <span class="font-semibold text-surface-900 dark:text-tertiary-200">
                    {activity.activityName ?? '—'}
                </span>
                <span class="text-xs opacity-70">{formatActivityType(activity.activityType)}</span>
            </div>
            <div class="flex flex-col leading-tight w-24">
                <span class="font-semibold">{formatDistance(activity.distanceM)}</span>
                <span class="text-xs opacity-70">DISTANCE</span>
            </div>
            <div class="flex flex-col leading-tight w-20">
                <span class="font-semibold">{formatDuration(activity.durationSec)}</span>
                <span class="text-xs opacity-70">TIME</span>
            </div>
            <div class="flex flex-col leading-tight w-24">
                <span class="font-semibold">
                    {formatPaceOrSpeed(activity.averageSpeed ?? undefined, activity.activityType)}
                </span>
                <span class="text-xs opacity-70">
                    {PACE_ACTIVITY_TYPES.has(activity.activityType) ? 'AVG PACE' : 'AVG SPEED'}
                </span>
            </div>
            <div class="flex flex-col leading-tight w-20">
                <span class="font-semibold">{formatElevation(activity.elevationGainM)}</span>
                <span class="text-xs opacity-70">ELEV GAIN</span>
            </div>
            <div class="flex flex-col leading-tight w-20">
                <span class="font-semibold">{formatHr(activity.averageHr)}</span>
                <span class="text-xs opacity-70">AVG HR</span>
            </div>
            <div class="flex flex-col leading-tight w-20">
                <span class="font-semibold">{formatCalories(activity.calories)}</span>
                <span class="text-xs opacity-70">CALORIES</span>
            </div>
        </div>
    </a>
</li>
