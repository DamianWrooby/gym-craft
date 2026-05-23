<script lang="ts">
    import type { MetricsLoadProfile, AcwrStatus } from '$lib/server/analytics/types';
    import StatCard from '$lib/components/stat-card/StatCard.svelte';
    import InfoTooltip from '$lib/components/info-tooltip/InfoTooltip.svelte';

    export let loadProfile: MetricsLoadProfile;

    const STATUS_LABEL: Record<AcwrStatus, string> = {
        undertraining: 'Under-training',
        optimal: 'Optimal load',
        overreach: 'Overreaching',
        'high-risk': 'High risk',
    };

    const STATUS_VARIANT: Record<AcwrStatus, string> = {
        undertraining: 'variant-soft-tertiary',
        optimal: 'variant-soft-success',
        overreach: 'variant-soft-warning',
        'high-risk': 'variant-soft-error',
    };

    function formatLoad(value: number): string {
        return value.toFixed(0);
    }

    function formatAcwr(value: number): string {
        if (value === 0) return '—';
        return value.toFixed(2);
    }

    function formatMonotony(value: number): string {
        if (!isFinite(value) || value === 0) return '—';
        return value.toFixed(2);
    }

    function formatChangePct(value: number | null): string {
        if (value == null) return '—';
        const sign = value >= 0 ? '+' : '−';
        return `${sign}${Math.abs(value).toFixed(0)}%`;
    }

    function changeClass(value: number | null): string {
        if (value == null) return '';
        if (value > 25) return 'text-warning-500';
        if (value < -25) return 'text-tertiary-500';
        return 'text-success-500';
    }
</script>

<section class="card {STATUS_VARIANT[loadProfile.acwrStatus]} p-5">
    <header class="flex items-center justify-between flex-wrap gap-2 mb-4">
        <div>
            <h2 class="h3 font-semibold">Training load</h2>
            <p class="text-xs opacity-70">28-day window · TRIMP-based</p>
        </div>
        <div class="flex items-center gap-1">
            <span class="chip variant-filled-surface text-xs uppercase tracking-wide">
                {STATUS_LABEL[loadProfile.acwrStatus]}
            </span>
            <InfoTooltip id="tooltip-status" ariaLabel="What this status means" placement="left">
                <p class="font-semibold mb-1">Training status (from ACWR)</p>
                <ul class="space-y-1">
                    <li><strong>Under-training</strong> · ACWR &lt; 0.8 — detraining risk if it persists.</li>
                    <li><strong>Optimal</strong> · 0.8–1.3 — sweet spot for adaptation.</li>
                    <li><strong>Overreaching</strong> · 1.3–1.5 — short-term overreach is OK; plan recovery.</li>
                    <li><strong>High risk</strong> · &gt; 1.5 — sharp load spike; elevated injury/illness risk.</li>
                </ul>
            </InfoTooltip>
        </div>
    </header>

    <div class="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
        <StatCard label="Acute (7d avg)" value={formatLoad(loadProfile.acute7d)}>
            <InfoTooltip slot="label-suffix" id="tooltip-acute" ariaLabel="What is acute load?">
                Average daily training load over the last 7 days. "Load" is Edwards' TRIMP — time in each HR zone
                weighted by zone intensity (1× for Z1 up to 5× for Z5). Higher = more recent stress on the body.
            </InfoTooltip>
        </StatCard>

        <StatCard label="Chronic (28d avg)" value={formatLoad(loadProfile.chronic28d)}>
            <InfoTooltip slot="label-suffix" id="tooltip-chronic" ariaLabel="What is chronic load?">
                Average daily training load over the last 28 days. Represents the fitness base you've built up — a
                higher chronic load means your body is adapted to handle more work.
            </InfoTooltip>
        </StatCard>

        <StatCard label="ACWR" value={formatAcwr(loadProfile.acwr)}>
            <InfoTooltip slot="label-suffix" id="tooltip-acwr" ariaLabel="What is ACWR?">
                Acute : Chronic Workload Ratio — acute (7d) divided by chronic (28d). The 0.8–1.3 band is the sweet spot
                for productive adaptation. Above 1.5 is a sharp spike with elevated injury risk.
            </InfoTooltip>
        </StatCard>

        <StatCard label="Monotony (7d)" value={formatMonotony(loadProfile.monotony)}>
            <InfoTooltip slot="label-suffix" id="tooltip-monotony" ariaLabel="What is monotony?">
                How uniform your training intensity has been over the last 7 days (mean ÷ standard deviation of daily
                load). Above 2.0 is concerning — too many same-effort sessions limit adaptation. Mix easy and hard days.
            </InfoTooltip>
        </StatCard>

        <StatCard
            label="Weekly load Δ"
            value={formatChangePct(loadProfile.weekOverWeekLoadChangePct)}
            valueClass={changeClass(loadProfile.weekOverWeekLoadChangePct)}>
            <InfoTooltip slot="label-suffix" id="tooltip-week-delta" ariaLabel="What is the weekly load delta?">
                Percent change in total weekly load versus the previous week. Jumps above +25% or drops below −25%
                compound the ACWR signal — sustainable progression is typically within ±10%.
            </InfoTooltip>
        </StatCard>
    </div>

    <p class="text-sm opacity-90">{loadProfile.acwrNarrative}</p>
    {#if loadProfile.monotonyIsHigh}
        <p class="text-sm opacity-90 mt-1">{loadProfile.monotonyNarrative}</p>
    {/if}

    {#if !loadProfile.hasSufficientHistory}
        <p class="text-xs opacity-70 mt-3 italic">
            Less than 28 days of history is available — chronic load and ACWR will sharpen as more activities sync.
        </p>
    {/if}
</section>
