<script lang="ts">
    import type { ActivityDynamics } from '$lib/server/garmin/fetch-activity-detail';
    import StatCard from '$lib/components/stat-card/StatCard.svelte';

    export let dynamics: ActivityDynamics;

    interface Field {
        value: number | null;
        label: string;
        fmt: (v: number) => string;
    }

    $: fields = (
        [
            { value: dynamics.avgCadence, label: 'Avg cadence', fmt: (v) => `${Math.round(v)} spm` },
            { value: dynamics.avgGroundContactTimeMs, label: 'Ground contact', fmt: (v) => `${Math.round(v)} ms` },
            { value: dynamics.avgVerticalOscillationCm, label: 'Vert. oscillation', fmt: (v) => `${v.toFixed(1)} cm` },
            { value: dynamics.avgVerticalRatioPct, label: 'Vert. ratio', fmt: (v) => `${v.toFixed(1)} %` },
            { value: dynamics.avgPowerW, label: 'Avg power', fmt: (v) => `${Math.round(v)} W` },
        ] as Field[]
    ).filter((f) => f.value != null);
</script>

{#if fields.length > 0}
    <section class="grid grid-cols-2 md:grid-cols-4 gap-3">
        {#each fields as f (f.label)}
            <StatCard label={f.label} value={f.fmt(f.value ?? 0)} />
        {/each}
    </section>
{/if}
