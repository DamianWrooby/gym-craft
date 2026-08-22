<script lang="ts">
    import type { RoutePoint } from '$lib/server/garmin/fetch-activity-detail';
    import { trimRoute, routeToSvgPath } from '$lib/utils/route';

    export let route: RoutePoint[];
    export let trimRadiusM = 200;

    $: trimmed = trimRoute(route, trimRadiusM);
    $: ({ d, width, height } = routeToSvgPath(trimmed, 320));
</script>

{#if d}
    <div class="rounded-xl border border-surface-300 dark:border-surface-700 p-4 bg-surface-100 dark:bg-surface-800 flex justify-center">
        <svg
            viewBox="-8 -8 {width + 16} {height + 16}"
            class="w-full max-w-md h-auto"
            role="img"
            aria-label="Activity route (start and end trimmed for privacy)">
            <path {d} class="fill-none stroke-primary-500" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" />
        </svg>
    </div>
    <p class="text-xs opacity-60 mt-1">Start and end trimmed to protect your home location.</p>
{/if}
