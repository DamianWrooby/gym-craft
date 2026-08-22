<script lang="ts">
    import type { GarminActivityHrZones } from '@/models/garmin/activity.model';

    export let zones: GarminActivityHrZones;

    const ZONE_META = [
        { key: 'zone1', label: 'Z1', cls: 'bg-surface-400' },
        { key: 'zone2', label: 'Z2', cls: 'bg-tertiary-500' },
        { key: 'zone3', label: 'Z3', cls: 'bg-success-500' },
        { key: 'zone4', label: 'Z4', cls: 'bg-warning-500' },
        { key: 'zone5', label: 'Z5', cls: 'bg-error-500' },
    ] as const;

    $: total = ZONE_META.reduce((sum, z) => sum + (zones[z.key] ?? 0), 0);
    $: segments = ZONE_META.map((z) => ({
        ...z,
        sec: zones[z.key] ?? 0,
        pct: total > 0 ? ((zones[z.key] ?? 0) / total) * 100 : 0,
    }));

    function fmt(sec: number): string {
        const m = Math.floor(sec / 60);
        const s = Math.round(sec % 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
    }
</script>

{#if total > 0}
    <div class="flex flex-col gap-2">
        <div class="flex w-full h-5 rounded-full overflow-hidden" role="img" aria-label="Heart rate zone distribution">
            {#each segments as seg (seg.key)}
                {#if seg.pct > 0}
                    <div class="{seg.cls} h-full" style="width: {seg.pct}%" title="{seg.label}: {fmt(seg.sec)}" />
                {/if}
            {/each}
        </div>
        <div class="flex flex-wrap gap-x-4 gap-y-1 text-xs">
            {#each segments as seg (seg.key)}
                {#if seg.sec > 0}
                    <span class="flex items-center gap-1.5">
                        <span class="{seg.cls} inline-block w-2.5 h-2.5 rounded-sm" />
                        {seg.label} · {fmt(seg.sec)} · {Math.round(seg.pct)}%
                    </span>
                {/if}
            {/each}
        </div>
    </div>
{:else}
    <p class="text-sm opacity-70 italic">No heart-rate zone data for this activity.</p>
{/if}
