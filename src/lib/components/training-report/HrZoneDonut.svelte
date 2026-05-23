<script lang="ts">
    import type { GarminActivityHrZones } from '@/models/garmin/activity.model';

    export let hrZoneSeconds: GarminActivityHrZones | null;
    export let hrZonePercents: GarminActivityHrZones | null;

    const ZONE_LABELS = ['Z1', 'Z2', 'Z3', 'Z4', 'Z5'] as const;
    const ZONE_COLORS = ['#fcd7d7', '#fca5a5', '#f87171', '#dc2626', '#7f1d1d'];

    type Slice = { label: string; color: string; seconds: number; percent: number };

    $: slices =
        hrZoneSeconds && hrZonePercents
            ? ([
                  {
                      label: ZONE_LABELS[0],
                      color: ZONE_COLORS[0],
                      seconds: hrZoneSeconds.zone1,
                      percent: hrZonePercents.zone1,
                  },
                  {
                      label: ZONE_LABELS[1],
                      color: ZONE_COLORS[1],
                      seconds: hrZoneSeconds.zone2,
                      percent: hrZonePercents.zone2,
                  },
                  {
                      label: ZONE_LABELS[2],
                      color: ZONE_COLORS[2],
                      seconds: hrZoneSeconds.zone3,
                      percent: hrZonePercents.zone3,
                  },
                  {
                      label: ZONE_LABELS[3],
                      color: ZONE_COLORS[3],
                      seconds: hrZoneSeconds.zone4,
                      percent: hrZonePercents.zone4,
                  },
                  {
                      label: ZONE_LABELS[4],
                      color: ZONE_COLORS[4],
                      seconds: hrZoneSeconds.zone5,
                      percent: hrZonePercents.zone5,
                  },
              ] satisfies Slice[])
            : [];

    $: totalSeconds = slices.reduce((sum, s) => sum + s.seconds, 0);

    function describeArc(cx: number, cy: number, r: number, innerR: number, startAngle: number, endAngle: number) {
        const start = polarToCartesian(cx, cy, r, endAngle);
        const end = polarToCartesian(cx, cy, r, startAngle);
        const innerStart = polarToCartesian(cx, cy, innerR, endAngle);
        const innerEnd = polarToCartesian(cx, cy, innerR, startAngle);
        const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';
        return [
            'M',
            start.x,
            start.y,
            'A',
            r,
            r,
            0,
            largeArcFlag,
            0,
            end.x,
            end.y,
            'L',
            innerEnd.x,
            innerEnd.y,
            'A',
            innerR,
            innerR,
            0,
            largeArcFlag,
            1,
            innerStart.x,
            innerStart.y,
            'Z',
        ].join(' ');
    }
    function polarToCartesian(cx: number, cy: number, r: number, angle: number) {
        const rad = ((angle - 90) * Math.PI) / 180;
        return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
    }

    $: arcs = computeArcs(slices, totalSeconds);
    function computeArcs(s: Slice[], total: number) {
        if (total <= 0) return [];
        let start = 0;
        return s.map((slice) => {
            const sweep = (slice.seconds / total) * 360;
            const arc = describeArc(60, 60, 56, 32, start, start + sweep);
            start += sweep;
            return { ...slice, arc };
        });
    }

    function ariaLabel(s: Slice[]): string {
        if (s.length === 0) return 'HR zone breakdown unavailable';
        const parts = s.filter((x) => x.percent > 0).map((x) => `${x.label} ${x.percent}%`);
        return `Heart rate zone distribution: ${parts.join(', ')}`;
    }
</script>

{#if slices.length > 0 && totalSeconds > 0}
    <div class="flex flex-col md:flex-row items-center gap-4" role="img" aria-label={ariaLabel(slices)}>
        <svg viewBox="0 0 120 120" class="w-40 h-40">
            {#each arcs as arc (arc.label)}
                <path d={arc.arc} fill={arc.color} />
            {/each}
        </svg>
        <ul class="text-sm space-y-1">
            {#each slices as slice (slice.label)}
                <li class="flex items-center gap-2">
                    <span class="inline-block w-3 h-3 rounded-sm" style="background-color: {slice.color}"></span>
                    <span class="font-semibold w-8">{slice.label}</span>
                    <span class="opacity-70">{slice.percent}%</span>
                </li>
            {/each}
        </ul>
    </div>
{/if}
