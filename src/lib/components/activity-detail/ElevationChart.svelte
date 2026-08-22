<script lang="ts">
    import type { ActivitySample } from '$lib/server/garmin/fetch-activity-detail';

    export let samples: ActivitySample[];

    const WIDTH = 720;
    const HEIGHT = 160;
    const PAD = { top: 12, right: 16, bottom: 24, left: 40 };

    $: pts = samples.filter((s) => s.elevationM != null);
    $: maxTime = pts.length > 0 ? pts[pts.length - 1].timestampSec : 0;
    $: elevs = pts.map((s) => s.elevationM as number);
    $: minE = elevs.length ? Math.min(...elevs) : 0;
    $: maxE = elevs.length ? Math.max(...elevs) : 1;

    function x(t: number): number {
        const usable = WIDTH - PAD.left - PAD.right;
        return maxTime === 0 ? PAD.left : PAD.left + (t / maxTime) * usable;
    }
    function y(e: number): number {
        const usable = HEIGHT - PAD.top - PAD.bottom;
        const span = maxE - minE || 1;
        return PAD.top + usable - ((e - minE) / span) * usable;
    }

    $: lineD = pts.map((s, i) => `${i === 0 ? 'M' : 'L'} ${x(s.timestampSec)} ${y(s.elevationM as number)}`).join(' ');
    $: areaD =
        pts.length > 1 ? `${lineD} L ${x(maxTime)} ${HEIGHT - PAD.bottom} L ${PAD.left} ${HEIGHT - PAD.bottom} Z` : '';
</script>

{#if pts.length > 1}
    <div
        class="rounded-xl border border-surface-300 dark:border-surface-700 p-3 bg-surface-100 dark:bg-surface-800 overflow-x-auto">
        <svg viewBox="0 0 {WIDTH} {HEIGHT}" class="w-full h-auto" aria-label="Elevation over time">
            <path d={areaD} class="fill-tertiary-500 opacity-15" />
            <path d={lineD} class="fill-none stroke-tertiary-500" stroke-width="1.5" />
            <text x={PAD.left - 6} y={y(maxE)} class="fill-current text-[10px] opacity-60" text-anchor="end"
                >{Math.round(maxE)} m</text>
            <text x={PAD.left - 6} y={y(minE)} class="fill-current text-[10px] opacity-60" text-anchor="end"
                >{Math.round(minE)} m</text>
        </svg>
    </div>
{:else}
    <p class="text-sm opacity-70 italic">No elevation data for this activity.</p>
{/if}
