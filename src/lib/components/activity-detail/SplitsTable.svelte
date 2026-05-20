<script lang="ts">
    import type { ActivitySplit } from '$lib/server/garmin/fetch-activity-detail';
    import { formatPaceOrSpeed } from '$lib/utils/pace';

    export let splits: ActivitySplit[];
    export let activityType: string;

    function formatDistance(meters: number): string {
        if (meters >= 1000) return `${(meters / 1000).toFixed(2)} km`;
        return `${Math.round(meters)} m`;
    }

    function formatDuration(sec: number): string {
        const m = Math.floor(sec / 60);
        const s = Math.floor(sec % 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
    }

    function formatHr(hr: number | null): string {
        if (hr == null) return '—';
        return `${Math.round(hr)}`;
    }

    function formatElev(m: number | null): string {
        if (m == null) return '—';
        return `${Math.round(m)} m`;
    }
</script>

{#if splits.length === 0}
    <p class="text-sm opacity-70 italic">No split data available for this activity.</p>
{:else}
    <div class="overflow-x-auto rounded-xl border border-surface-300 dark:border-surface-700">
        <table class="table table-compact w-full">
            <thead>
                <tr>
                    <th>#</th>
                    <th>Distance</th>
                    <th>Time</th>
                    <th>Pace / Speed</th>
                    <th>Avg HR</th>
                    <th>Elev +/−</th>
                </tr>
            </thead>
            <tbody>
                {#each splits as split}
                    <tr>
                        <td class="font-mono opacity-70">{split.splitIndex + 1}</td>
                        <td>{formatDistance(split.distanceM)}</td>
                        <td>{formatDuration(split.durationSec)}</td>
                        <td>{formatPaceOrSpeed(split.averageSpeed, activityType)}</td>
                        <td>{formatHr(split.averageHr)}</td>
                        <td class="text-xs">
                            {formatElev(split.elevationGainM)} / {formatElev(split.elevationLossM)}
                        </td>
                    </tr>
                {/each}
            </tbody>
        </table>
    </div>
{/if}
