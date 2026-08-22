<script lang="ts">
    import type { RoutePoint } from '$lib/server/garmin/fetch-activity-detail';
    import { trimRoute, routeToSvgPath } from '$lib/utils/route';

    export let route: RoutePoint[];
    export let trimRadiusM = 200;

    // Compact header decoration: a small, non-interactive polyline. Start/end are trimmed so the
    // athlete's home location is never drawn. Deliberately not a map — no pan, zoom, or basemap.
    $: trimmed = trimRoute(route, trimRadiusM);
    $: ({ d, width, height } = routeToSvgPath(trimmed, 120));
</script>

{#if d}
    <svg
        viewBox="-6 -6 {width + 12} {height + 12}"
        class="h-16 w-auto max-w-[8rem] shrink-0 opacity-80"
        role="img"
        aria-label="Activity route (start and end trimmed for privacy)">
        <path
            {d}
            class="fill-none stroke-primary-500"
            stroke-width="3"
            stroke-linejoin="round"
            stroke-linecap="round" />
    </svg>
{/if}
