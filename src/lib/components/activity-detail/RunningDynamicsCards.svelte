<script lang="ts">
    import { m } from '$lib/paraglide/messages.js';
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
            { value: dynamics.avgCadence, label: m.dynamics_cadence(), fmt: (v) => `${Math.round(v)} spm` },
            {
                value: dynamics.avgGroundContactTimeMs,
                label: m.dynamics_ground_contact(),
                fmt: (v) => `${Math.round(v)} ms`,
            },
            {
                value: dynamics.avgVerticalOscillationCm,
                label: m.dynamics_vert_oscillation(),
                fmt: (v) => `${v.toFixed(1)} cm`,
            },
            { value: dynamics.avgVerticalRatioPct, label: m.dynamics_vert_ratio(), fmt: (v) => `${v.toFixed(1)} %` },
            { value: dynamics.avgPowerW, label: m.dynamics_power(), fmt: (v) => `${Math.round(v)} W` },
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
