<script lang="ts">
    import type { MetricsBundle } from '$lib/server/analytics/types';

    export let deltas: MetricsBundle['deltas'];

    type Card = { label: string; value: string; delta: number };

    function formatDistance(meters: number): string {
        const sign = meters >= 0 ? '+' : '−';
        return `${sign}${(Math.abs(meters) / 1000).toFixed(2)} km`;
    }
    function formatDuration(seconds: number): string {
        const sign = seconds >= 0 ? '+' : '−';
        const abs = Math.abs(seconds);
        const m = Math.floor(abs / 60);
        return `${sign}${m} min`;
    }
    function formatMinutes(min: number): string {
        const sign = min >= 0 ? '+' : '−';
        return `${sign}${Math.abs(min)} min`;
    }
    function formatHr(bpm: number): string {
        const sign = bpm >= 0 ? '+' : '−';
        return `${sign}${Math.abs(bpm).toFixed(1)} bpm`;
    }

    $: cards = deltas
        ? ([
              { label: 'Distance vs prev week', value: formatDistance(deltas.distanceM), delta: deltas.distanceM },
              { label: 'Duration vs prev week', value: formatDuration(deltas.durationSec), delta: deltas.durationSec },
              {
                  label: 'Vigorous minutes vs prev week',
                  value: formatMinutes(deltas.vigorousMinutes),
                  delta: deltas.vigorousMinutes,
              },
              ...(deltas.avgHRDelta !== null
                  ? [
                        {
                            label: 'Avg HR vs prev week',
                            value: formatHr(deltas.avgHRDelta),
                            // For HR, lower is generally "better" (improved efficiency at same load).
                            // We don't invert the color here — caller can read the value.
                            delta: deltas.avgHRDelta,
                        },
                    ]
                  : []),
          ] satisfies Card[])
        : [];
</script>

{#if deltas}
    <div class="grid grid-cols-2 md:grid-cols-4 gap-3" role="group" aria-label="Week-over-week stat deltas">
        {#each cards as card}
            <div
                class="rounded-xl border border-surface-300 dark:border-surface-700 p-3 bg-surface-100 dark:bg-surface-800">
                <p class="text-xs opacity-70 uppercase tracking-wide">{card.label}</p>
                <p
                    class="text-lg font-semibold mt-1"
                    class:text-success-600={card.delta > 0}
                    class:text-error-500={card.delta < 0}>
                    {card.value}
                </p>
            </div>
        {/each}
    </div>
{/if}
