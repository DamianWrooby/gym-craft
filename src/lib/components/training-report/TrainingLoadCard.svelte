<script lang="ts">
    import { m } from '$lib/paraglide/messages.js';
    import { statusLabel } from '$lib/utils/load-status';
    import type { MetricsLoadProfile, AcwrStatus } from '$lib/server/analytics/types';
    import StatCard from '$lib/components/stat-card/StatCard.svelte';
    import InfoTooltip from '$lib/components/info-tooltip/InfoTooltip.svelte';

    export let loadProfile: MetricsLoadProfile;

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
            <h2 class="h3 font-semibold">{m.activity_training_load()}</h2>
            <p class="text-xs opacity-70">{m.load_card_window()}</p>
        </div>
        <div class="flex items-center gap-1">
            <span class="chip variant-filled-surface text-xs uppercase tracking-wide">
                {statusLabel(loadProfile.acwrStatus)}
            </span>
            <InfoTooltip id="tooltip-status" ariaLabel={m.load_card_status_aria()} placement="left">
                <p class="font-semibold mb-1">{m.load_card_status_heading()}</p>
                <ul class="space-y-1">
                    <li>
                        <strong>{m.load_status_undertraining()}</strong> · ACWR &lt; 0.8 — {m.load_card_undertraining()}
                    </li>
                    <li><strong>{m.load_status_optimal()}</strong> · 0.8–1.3 — {m.load_card_optimal()}</li>
                    <li><strong>{m.load_status_overreach()}</strong> · 1.3–1.5 — {m.load_card_overreach()}</li>
                    <li><strong>{m.load_status_high_risk()}</strong> · &gt; 1.5 — {m.load_card_high_risk()}</li>
                </ul>
            </InfoTooltip>
        </div>
    </header>

    <div class="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
        <StatCard label={m.load_card_acute()} value={formatLoad(loadProfile.acute7d)}>
            <InfoTooltip slot="label-suffix" id="tooltip-acute" ariaLabel={m.load_card_acute_aria()}>
                {m.load_card_acute_help()}
            </InfoTooltip>
        </StatCard>

        <StatCard label={m.load_card_chronic()} value={formatLoad(loadProfile.chronic28d)}>
            <InfoTooltip slot="label-suffix" id="tooltip-chronic" ariaLabel={m.load_card_chronic_aria()}>
                {m.load_card_chronic_help()}
            </InfoTooltip>
        </StatCard>

        <StatCard label="ACWR" value={formatAcwr(loadProfile.acwr)}>
            <InfoTooltip slot="label-suffix" id="tooltip-acwr" ariaLabel={m.load_card_acwr_aria()}>
                {m.load_card_acwr_help()}
            </InfoTooltip>
        </StatCard>

        <StatCard label={m.load_card_monotony()} value={formatMonotony(loadProfile.monotony)}>
            <InfoTooltip slot="label-suffix" id="tooltip-monotony" ariaLabel={m.load_card_monotony_aria()}>
                {m.load_card_monotony_help()}
            </InfoTooltip>
        </StatCard>

        <StatCard
            label={m.load_card_weekly_delta()}
            value={formatChangePct(loadProfile.weekOverWeekLoadChangePct)}
            valueClass={changeClass(loadProfile.weekOverWeekLoadChangePct)}>
            <InfoTooltip slot="label-suffix" id="tooltip-week-delta" ariaLabel={m.load_card_weekly_delta_aria()}>
                {m.load_card_weekly_delta_help()}
            </InfoTooltip>
        </StatCard>
    </div>

    <p class="text-sm opacity-90">{loadProfile.acwrNarrative}</p>
    {#if loadProfile.monotonyIsHigh}
        <p class="text-sm opacity-90 mt-1">{loadProfile.monotonyNarrative}</p>
    {/if}

    {#if !loadProfile.hasSufficientHistory}
        <p class="text-xs opacity-70 mt-3 italic">
            {m.load_card_short_history()}
        </p>
    {/if}
</section>
