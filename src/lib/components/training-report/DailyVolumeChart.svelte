<script lang="ts">
    import { max } from 'd3-array';
    import type { MetricsBundle } from '$lib/server/analytics/types';

    export let byDay: MetricsBundle['volume']['byDay'];

    type Bar = {
        date: string;
        label: string;
        km: number;
        durationSec: number;
    };

    $: data = byDay.map<Bar>((d) => ({
        date: d.date,
        label: weekdayLabel(d.date),
        km: d.distanceM / 1000,
        durationSec: d.durationSec,
    }));
    $: yMax = Math.max(1, max(data, (d) => d.km) ?? 1);

    let chartWidth = 0;
    const chartHeight = 240;
    const padLeft = 28;
    const padRight = 4;
    const padTop = 18;
    const padBottom = 36;
    const axisFont = 10;
    const barFill = 0.6;
    $: plotW = Math.max(0, chartWidth - padLeft - padRight);
    $: plotH = Math.max(0, chartHeight - padTop - padBottom);

    let activeDate: string | null = null;
    $: activeBar = data.find((d) => d.date === activeDate) ?? null;
    $: activeIndex = activeBar ? data.findIndex((d) => d.date === activeBar.date) : -1;
    $: tooltipStyle = activeBar && activeIndex >= 0 ? computeTooltipStyle(activeBar, activeIndex) : '';

    function barX(i: number, n: number): number {
        const slot = plotW / n;
        return padLeft + i * slot + (slot * (1 - barFill)) / 2;
    }
    function barW(n: number): number {
        return Math.max(2, (plotW / n) * barFill);
    }
    function barH(km: number): number {
        return (km / yMax) * plotH;
    }

    function weekdayLabel(yyyymmdd: string): string {
        const d = new Date(`${yyyymmdd}T00:00:00Z`);
        return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getUTCDay()];
    }

    function formatTick(km: number): string {
        if (km === 0) return '0';
        return km < 10 ? km.toFixed(1) : Math.round(km).toString();
    }

    function formatFullDate(yyyymmdd: string): string {
        const d = new Date(`${yyyymmdd}T00:00:00Z`);
        return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', timeZone: 'UTC' });
    }

    function formatDistance(km: number): string {
        return `${km.toFixed(2)} km`;
    }

    function formatDuration(s: number): string {
        if (s <= 0) return '0:00';
        const h = Math.floor(s / 3600);
        const m = Math.floor((s % 3600) / 60);
        const sec = Math.floor(s % 60);
        if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
        return `${m}:${sec.toString().padStart(2, '0')}`;
    }

    function formatPace(km: number, sec: number): string | null {
        if (km <= 0 || sec <= 0) return null;
        const secPerKm = sec / km;
        const m = Math.floor(secPerKm / 60);
        const s = Math.floor(secPerKm % 60);
        return `${m}:${s.toString().padStart(2, '0')}/km`;
    }

    function computeTooltipStyle(bar: Bar, index: number): string {
        if (chartWidth <= 0) return '';
        const cx = barX(index, data.length) + barW(data.length) / 2;
        const top = padTop + plotH - barH(bar.km);
        const leftPct = (cx / chartWidth) * 100;
        const tx = leftPct > 70 ? '-100%' : leftPct < 30 ? '0%' : '-50%';
        return `left:${cx}px;top:${top}px;transform:translate(${tx},calc(-100% - 0.5rem));`;
    }

    function handleSelect(date: string) {
        activeDate = activeDate === date ? null : date;
    }
    function handleDismiss() {
        activeDate = null;
    }

    function barAria(d: Bar): string {
        if (d.km === 0) return `${formatFullDate(d.date)}: rest day`;
        return `${formatFullDate(d.date)}: ${formatDistance(d.km)}, ${formatDuration(d.durationSec)}`;
    }

    function summary(d: typeof data): string {
        const total = d.reduce((sum, e) => sum + e.km, 0);
        return `Daily distance over ${d.length} days, total ${total.toFixed(2)} km`;
    }
</script>

<div class="chart-root" role="img" aria-label={summary(data)}>
    <div class="flex gap-2 items-stretch">
        <div class="y-axis-title">Distance (km)</div>
        <div
            class="chart-wrapper flex-1"
            style="height:{chartHeight}px"
            bind:clientWidth={chartWidth}
            on:mouseleave={handleDismiss}
            role="presentation">
            {#if chartWidth > 0}
                <svg width={chartWidth} height={chartHeight} class="block">
                    <g class="axis-y">
                        {#each [0, 0.25, 0.5, 0.75, 1] as t}
                            {@const ty = padTop + (1 - t) * plotH}
                            <line
                                x1={padLeft}
                                x2={chartWidth - padRight}
                                y1={ty}
                                y2={ty}
                                stroke="currentColor"
                                stroke-opacity="0.1" />
                            <text
                                x={padLeft - 6}
                                y={ty}
                                dy="3"
                                text-anchor="end"
                                class="fill-current opacity-70"
                                font-size={axisFont}>{formatTick(t * yMax)}</text>
                        {/each}
                    </g>
                    <rect
                        x="0"
                        y="0"
                        width={chartWidth}
                        height={chartHeight}
                        fill="transparent"
                        on:click|self={handleDismiss}
                        role="presentation" />
                    {#each data as d, i (d.date)}
                        {@const x = barX(i, data.length)}
                        {@const w = barW(data.length)}
                        {@const h = barH(d.km)}
                        {@const y = padTop + plotH - h}
                        {@const hitH = Math.max(h, 6)}
                        {@const hitY = padTop + plotH - hitH}
                        {@const radius = Math.min(4, w / 2, h / 2)}
                        <rect
                            {x}
                            {y}
                            width={w}
                            height={h}
                            rx={radius}
                            ry={radius}
                            class="bar fill-primary-500 dark:fill-tertiary-500"
                            class:active={activeDate === d.date} />
                        <rect
                            {x}
                            y={hitY}
                            width={w}
                            height={hitH}
                            class="hit"
                            tabindex="0"
                            role="button"
                            aria-label={barAria(d)}
                            on:mouseenter={() => (activeDate = d.date)}
                            on:focus={() => (activeDate = d.date)}
                            on:blur={() => (activeDate = null)}
                            on:click|stopPropagation={() => handleSelect(d.date)}
                            on:keydown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    handleSelect(d.date);
                                }
                            }} />
                        <text
                            x={x + w / 2}
                            y={padTop + plotH + axisFont + 8}
                            text-anchor="middle"
                            class="fill-current opacity-60"
                            font-size={axisFont}>{d.label}</text>
                        {#if d.km > 0}
                            <text x={x + w / 2} y={y - 4} text-anchor="middle" class="fill-current" font-size={axisFont}
                                >{d.km.toFixed(1)}</text>
                        {/if}
                    {/each}
                </svg>
            {/if}
            {#if activeBar}
                <div class="tooltip" style={tooltipStyle}>
                    <p class="font-semibold text-sm">{formatFullDate(activeBar.date)}</p>
                    {#if activeBar.km === 0}
                        <p class="text-xs opacity-80 mt-1">Rest day</p>
                    {:else}
                        <dl class="tooltip-grid">
                            <dt>Distance</dt>
                            <dd>{formatDistance(activeBar.km)}</dd>
                            <dt>Duration</dt>
                            <dd>{formatDuration(activeBar.durationSec)}</dd>
                            {#if formatPace(activeBar.km, activeBar.durationSec)}
                                <dt>Avg pace</dt>
                                <dd>{formatPace(activeBar.km, activeBar.durationSec)}</dd>
                            {/if}
                        </dl>
                    {/if}
                </div>
            {/if}
        </div>
    </div>
    <p class="day-axis-title">Day of week</p>
</div>

<style>
    .chart-root {
        width: 100%;
    }
    .chart-wrapper {
        width: 100%;
        position: relative;
        overflow: hidden;
    }
    .y-axis-title {
        writing-mode: vertical-rl;
        transform: rotate(180deg);
        font-size: 0.7rem;
        opacity: 0.6;
        align-self: center;
        flex-shrink: 0;
    }
    .day-axis-title {
        font-size: 0.7rem;
        opacity: 0.6;
        text-align: center;
        margin-top: 1rem;
    }
    @media (max-width: 380px) {
        .y-axis-title {
            display: none;
        }
    }
    .bar {
        transition: opacity 120ms ease;
    }
    .bar.active {
        opacity: 0.8;
    }
    .hit {
        fill: transparent;
        cursor: pointer;
    }
    .hit:focus {
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
