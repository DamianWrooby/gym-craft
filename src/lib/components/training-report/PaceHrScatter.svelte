<script lang="ts">
    import type { MetricsBundle } from '$lib/server/analytics/types';

    export let efficiency: MetricsBundle['efficiency'];

    type Point = {
        activityId: number;
        pace: number;
        hr: number;
        startTimeLocal?: string;
        activityName?: string;
        distanceM?: number;
        durationSec?: number;
    };

    $: points = efficiency.perActivity
        .filter(
            (p): p is typeof p & { avgPaceSecPerKm: number; avgHR: number } =>
                p.avgPaceSecPerKm !== null && p.avgHR !== null,
        )
        .map(
            (p) =>
                ({
                    activityId: p.activityId,
                    pace: p.avgPaceSecPerKm,
                    hr: p.avgHR,
                    startTimeLocal: p.startTimeLocal,
                    activityName: p.activityName,
                    distanceM: p.distanceM,
                    durationSec: p.durationSec,
                }) satisfies Point,
        );

    $: paceDomain = computeRange(points.map((p) => p.pace));
    $: hrDomain = computeRange(points.map((p) => p.hr));

    let activeId: number | null = null;
    $: activePoint = points.find((p) => p.activityId === activeId) ?? null;
    $: tooltipStyle = activePoint ? computeTooltipStyle(activePoint) : '';

    function computeRange(values: number[]): [number, number] {
        if (values.length === 0) return [0, 1];
        const min = Math.min(...values);
        const max = Math.max(...values);
        const span = max - min || 1;
        return [min - span * 0.1, max + span * 0.1];
    }

    function paceLabel(secPerKm: number): string {
        const m = Math.floor(secPerKm / 60);
        const s = Math.floor(secPerKm % 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
    }

    // Returns 0..100 for percentage positioning inside the SVG.
    // Fast pace (low sec/km) is on the RIGHT; slow pace (high sec/km) on the LEFT.
    function scaleXPct(value: number): number {
        const [min, max] = paceDomain;
        return 100 - ((value - min) / (max - min || 1)) * 100;
    }
    function scaleYPct(value: number): number {
        const [min, max] = hrDomain;
        return 100 - ((value - min) / (max - min || 1)) * 100;
    }

    function formatDate(iso?: string): string {
        if (!iso) return '';
        const date = new Date(iso.replace(' ', 'T'));
        if (Number.isNaN(date.getTime())) return '';
        return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    }

    function formatDistance(m?: number): string {
        if (m === undefined) return '';
        return `${(m / 1000).toFixed(2)} km`;
    }

    function formatDuration(s?: number): string {
        if (s === undefined) return '';
        const h = Math.floor(s / 3600);
        const m = Math.floor((s % 3600) / 60);
        const sec = Math.floor(s % 60);
        if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
        return `${m}:${sec.toString().padStart(2, '0')}`;
    }

    function computeTooltipStyle(p: Point): string {
        const xPct = scaleXPct(p.pace);
        const yPct = scaleYPct(p.hr);
        const tx = xPct > 70 ? '-100%' : xPct < 30 ? '0%' : '-50%';
        const ty = yPct < 40 ? '0.5rem' : 'calc(-100% - 0.5rem)';
        return `left:${xPct}%;top:${yPct}%;transform:translate(${tx},${ty});`;
    }

    function handleSelect(id: number) {
        activeId = activeId === id ? null : id;
    }
    function handleDismiss() {
        activeId = null;
    }
    function dotAria(p: Point): string {
        const dateStr = formatDate(p.startTimeLocal) || 'Activity';
        return `${dateStr}: ${paceLabel(p.pace)}/km at ${Math.round(p.hr)} bpm`;
    }

    function ariaLabel(): string {
        if (points.length === 0) return 'Pace vs HR plot — no data points';
        return `Pace vs HR plot with ${points.length} activities. Pace ranges ${paceLabel(paceDomain[0])} to ${paceLabel(paceDomain[1])} per km, HR ${Math.round(hrDomain[0])} to ${Math.round(hrDomain[1])} bpm.`;
    }
</script>

{#if points.length > 0}
    <div class="chart-root" role="img" aria-label={ariaLabel()}>
        <div class="flex gap-2 items-stretch">
            <div class="y-axis-title">Avg HR (bpm)</div>
            <div class="y-axis-labels flex flex-col justify-between text-xs opacity-70">
                <span>{Math.round(hrDomain[1])}</span>
                <span>{Math.round(hrDomain[0])}</span>
            </div>
            <div class="plot relative flex-1">
                <svg class="plot-svg" role="presentation" on:click|self={handleDismiss}>
                    {#each [0, 25, 50, 75, 100] as t}
                        <line x1="0%" x2="100%" y1={`${t}%`} y2={`${t}%`} stroke="currentColor" stroke-opacity="0.1" />
                        <line x1={`${t}%`} x2={`${t}%`} y1="0%" y2="100%" stroke="currentColor" stroke-opacity="0.1" />
                    {/each}
                    {#each points as p (p.activityId)}
                        <circle
                            cx={`${scaleXPct(p.pace)}%`}
                            cy={`${scaleYPct(p.hr)}%`}
                            r={activeId === p.activityId ? 7 : 5}
                            class="dot fill-primary-500 dark:fill-tertiary-500"
                            tabindex="0"
                            role="button"
                            aria-label={dotAria(p)}
                            on:mouseenter={() => (activeId = p.activityId)}
                            on:focus={() => (activeId = p.activityId)}
                            on:blur={() => (activeId = null)}
                            on:click|stopPropagation={() => handleSelect(p.activityId)}
                            on:keydown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    handleSelect(p.activityId);
                                }
                            }} />
                    {/each}
                </svg>
                {#if activePoint}
                    <div class="tooltip" style={tooltipStyle}>
                        {#if activePoint.activityName}
                            <p class="font-semibold text-sm">{activePoint.activityName}</p>
                        {/if}
                        {#if activePoint.startTimeLocal}
                            <p class="text-xs opacity-80">{formatDate(activePoint.startTimeLocal)}</p>
                        {/if}
                        <dl class="tooltip-grid">
                            {#if activePoint.distanceM !== undefined}
                                <dt>Distance</dt>
                                <dd>{formatDistance(activePoint.distanceM)}</dd>
                            {/if}
                            {#if activePoint.durationSec !== undefined}
                                <dt>Duration</dt>
                                <dd>{formatDuration(activePoint.durationSec)}</dd>
                            {/if}
                            <dt>Pace</dt>
                            <dd>{paceLabel(activePoint.pace)}/km</dd>
                            <dt>Avg HR</dt>
                            <dd>{Math.round(activePoint.hr)} bpm</dd>
                        </dl>
                    </div>
                {/if}
            </div>
        </div>

        <div class="flex gap-2 mt-1">
            <div class="y-axis-title invisible" aria-hidden="true">Avg HR (bpm)</div>
            <div class="y-axis-labels" aria-hidden="true"></div>
            <div class="flex-1">
                <div class="flex justify-between text-xs opacity-70">
                    <span>{paceLabel(paceDomain[1])}/km (slow)</span>
                    <span>{paceLabel(paceDomain[0])}/km (fast)</span>
                </div>
                <p class="text-xs opacity-70 text-center mt-1">Pace (min:sec / km)</p>
            </div>
        </div>

        <p class="text-xs opacity-60 mt-2">
            Higher dot = higher HR. Bottom-right = improved efficiency (fast pace, low HR); top-right = hard efforts.
        </p>
    </div>
{/if}

<style>
    .chart-root {
        width: 100%;
    }
    .plot-svg {
        width: 100%;
        height: 260px;
        display: block;
        overflow: visible;
    }
    .y-axis-title {
        writing-mode: vertical-rl;
        transform: rotate(180deg);
        font-size: 0.75rem;
        opacity: 0.7;
        align-self: center;
    }
    .y-axis-labels {
        min-width: 2.25rem;
        text-align: right;
    }
    .dot {
        cursor: pointer;
        transition:
            r 120ms ease,
            opacity 120ms ease;
    }
    .dot:focus {
        outline: none;
    }
    .tooltip {
        position: absolute;
        background: rgb(15 23 42 / 0.95);
        color: rgb(241 245 249);
        border: 1px solid rgb(71 85 105);
        border-radius: 0.375rem;
        padding: 0.5rem 0.65rem;
        pointer-events: none;
        white-space: nowrap;
        z-index: 10;
        box-shadow: 0 4px 12px rgb(0 0 0 / 0.3);
    }
    .tooltip-grid {
        display: grid;
        grid-template-columns: auto auto;
        column-gap: 0.75rem;
        row-gap: 0.125rem;
        font-size: 0.75rem;
        margin-top: 0.25rem;
    }
    .tooltip-grid dt {
        opacity: 0.6;
    }
</style>
