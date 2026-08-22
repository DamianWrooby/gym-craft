<script lang="ts">
    import type { ActivitySplit } from '$lib/server/garmin/fetch-activity-detail';
    import { formatPaceOrSpeed } from '$lib/utils/pace';

    export let splits: ActivitySplit[];
    export let activityType: string;

    // Bar height encodes speed (taller = faster); colour encodes average HR (light -> dark = low -> high).
    // Speed rather than pace keeps the maths modality-agnostic: cycling and running both map higher = taller.
    function splitSpeed(s: ActivitySplit): number {
        if (s.averageSpeed && s.averageSpeed > 0) return s.averageSpeed;
        if (s.distanceM > 0 && s.durationSec > 0) return s.distanceM / s.durationSec;
        return 0;
    }

    $: usable = splits.filter((s) => splitSpeed(s) > 0);
    $: speeds = usable.map(splitSpeed);
    $: maxSpeed = speeds.length ? Math.max(...speeds) : 1;
    $: minSpeed = speeds.length ? Math.min(...speeds) : 0;

    $: hrs = usable.map((s) => s.averageHr).filter((h): h is number => h != null);
    $: minHr = hrs.length ? Math.min(...hrs) : 0;
    $: maxHr = hrs.length ? Math.max(...hrs) : 1;

    const HR_COLORS = ['#fcd7d7', '#fca5a5', '#f87171', '#dc2626', '#7f1d1d'];

    function hrColor(hr: number | null): string {
        if (hr == null || maxHr === minHr) return '#f87171';
        const t = (hr - minHr) / (maxHr - minHr);
        return HR_COLORS[Math.min(HR_COLORS.length - 1, Math.floor(t * HR_COLORS.length))];
    }

    // Map speed into 20%..100% so even small differences between splits stay visible.
    function barHeightPct(s: ActivitySplit): number {
        if (maxSpeed === minSpeed) return 100;
        return 20 + ((splitSpeed(s) - minSpeed) / (maxSpeed - minSpeed)) * 80;
    }

    function splitTitle(s: ActivitySplit): string {
        const pace = formatPaceOrSpeed(splitSpeed(s), activityType);
        const hr = s.averageHr != null ? ` · ${Math.round(s.averageHr)} bpm` : '';
        return `Split ${s.splitIndex + 1}: ${pace}${hr}`;
    }

    // The unit-less value shown inside each bar on desktop (e.g. "5:00" or "24.1").
    function shortPace(s: ActivitySplit): string {
        return formatPaceOrSpeed(splitSpeed(s), activityType).replace(' /km', '').replace(' km/h', '');
    }
</script>

{#if usable.length > 0}
    <div
        class="rounded-xl border border-surface-300 dark:border-surface-700 p-4 bg-surface-100 dark:bg-surface-800 overflow-x-auto">
        <div class="flex items-end gap-1.5 h-40" role="img" aria-label="Pace by split, coloured by average heart rate">
            {#each usable as s (s.splitIndex)}
                <div class="flex flex-col items-center justify-end flex-1 min-w-[1.5rem] h-full">
                    <div
                        class="flex w-full items-end justify-center rounded-t"
                        style="height: {barHeightPct(s)}%; background-color: {hrColor(s.averageHr)}"
                        title={splitTitle(s)}>
                        <span
                            class="hidden pb-1 text-[10px] font-semibold tabular-nums text-white/95 [text-shadow:0_1px_2px_rgba(0,0,0,0.55)] md:block">
                            {shortPace(s)}
                        </span>
                    </div>
                    <span class="text-[10px] opacity-60 mt-1 tabular-nums">{s.splitIndex + 1}</span>
                </div>
            {/each}
        </div>
        <p class="text-xs opacity-60 mt-2">Taller = faster · colour = avg HR (light → dark = low → high)</p>
    </div>
{:else}
    <p class="text-sm opacity-70 italic">No split data available for this activity.</p>
{/if}
