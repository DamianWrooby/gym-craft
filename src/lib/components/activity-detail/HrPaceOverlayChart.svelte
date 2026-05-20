<script lang="ts">
    import type { ActivitySample } from '$lib/server/garmin/fetch-activity-detail';

    export let samples: ActivitySample[];

    const WIDTH = 720;
    const HEIGHT = 240;
    const PADDING = { top: 16, right: 56, bottom: 32, left: 48 };

    $: hrSamples = samples.filter((s) => s.heartRate != null);
    $: speedSamples = samples.filter((s) => s.speed != null && s.speed > 0);

    $: maxTime = samples.length > 0 ? samples[samples.length - 1].timestampSec : 0;

    $: hrRange = bounds(hrSamples.map((s) => s.heartRate as number));
    $: paceRange = bounds(speedSamples.map((s) => 1000 / (s.speed as number)));

    function bounds(values: number[]): { min: number; max: number } {
        if (values.length === 0) return { min: 0, max: 1 };
        const min = Math.min(...values);
        const max = Math.max(...values);
        if (min === max) return { min: min - 1, max: max + 1 };
        return { min, max };
    }

    function xScale(t: number): number {
        if (maxTime === 0) return PADDING.left;
        const usable = WIDTH - PADDING.left - PADDING.right;
        return PADDING.left + (t / maxTime) * usable;
    }

    function yScaleHr(hr: number): number {
        const usable = HEIGHT - PADDING.top - PADDING.bottom;
        return PADDING.top + usable - ((hr - hrRange.min) / (hrRange.max - hrRange.min)) * usable;
    }

    function yScalePace(secPerKm: number): number {
        const usable = HEIGHT - PADDING.top - PADDING.bottom;
        return PADDING.top + ((secPerKm - paceRange.min) / (paceRange.max - paceRange.min)) * usable;
    }

    $: hrPathD = hrSamples
        .map((s, i) => `${i === 0 ? 'M' : 'L'} ${xScale(s.timestampSec)} ${yScaleHr(s.heartRate as number)}`)
        .join(' ');

    $: pacePathD = speedSamples
        .map((s, i) => `${i === 0 ? 'M' : 'L'} ${xScale(s.timestampSec)} ${yScalePace(1000 / (s.speed as number))}`)
        .join(' ');

    function formatTime(sec: number): string {
        const m = Math.floor(sec / 60);
        const s = Math.floor(sec % 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
    }

    function formatPace(secPerKm: number): string {
        const m = Math.floor(secPerKm / 60);
        const s = Math.floor(secPerKm % 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
    }
</script>

{#if samples.length === 0}
    <p class="text-sm opacity-70 italic">No time-series data available for this activity.</p>
{:else}
    <div class="rounded-xl border border-surface-300 dark:border-surface-700 p-3 bg-surface-100 dark:bg-surface-800 overflow-x-auto">
        <svg viewBox="0 0 {WIDTH} {HEIGHT}" class="w-full h-auto" aria-label="Heart rate and pace over time">
            <text x={PADDING.left} y={12} class="fill-error-500 text-xs">Heart rate (bpm)</text>
            <text x={WIDTH - PADDING.right} y={12} class="fill-primary-500 text-xs" text-anchor="end">Pace (min/km)</text>

            <line
                x1={PADDING.left}
                y1={HEIGHT - PADDING.bottom}
                x2={WIDTH - PADDING.right}
                y2={HEIGHT - PADDING.bottom}
                class="stroke-surface-500 opacity-40" />

            <text x={PADDING.left - 6} y={yScaleHr(hrRange.max)} class="fill-current text-[10px] opacity-60" text-anchor="end">{Math.round(hrRange.max)}</text>
            <text x={PADDING.left - 6} y={yScaleHr(hrRange.min)} class="fill-current text-[10px] opacity-60" text-anchor="end">{Math.round(hrRange.min)}</text>

            <text x={WIDTH - PADDING.right + 6} y={yScalePace(paceRange.min)} class="fill-current text-[10px] opacity-60">{formatPace(paceRange.min)}</text>
            <text x={WIDTH - PADDING.right + 6} y={yScalePace(paceRange.max)} class="fill-current text-[10px] opacity-60">{formatPace(paceRange.max)}</text>

            <text x={PADDING.left} y={HEIGHT - 8} class="fill-current text-[10px] opacity-60">0:00</text>
            <text x={WIDTH - PADDING.right} y={HEIGHT - 8} class="fill-current text-[10px] opacity-60" text-anchor="end">{formatTime(maxTime)}</text>

            {#if speedSamples.length > 1}
                <path d={pacePathD} class="fill-none stroke-primary-500 opacity-70" stroke-width="1.5" />
            {/if}
            {#if hrSamples.length > 1}
                <path d={hrPathD} class="fill-none stroke-error-500" stroke-width="1.5" />
            {/if}
        </svg>
    </div>
{/if}
