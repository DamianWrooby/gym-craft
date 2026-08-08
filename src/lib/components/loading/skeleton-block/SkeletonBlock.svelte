<script lang="ts">
    /**
     * Placeholder shimmer for content that is still streaming in.
     *
     * Classes are passed whole (`h-4`, not `4`) so Tailwind's scanner sees them as
     * literals at the call site — the `w-{size}` style of interpolation is what forced
     * the `safelist` entries in tailwind.config.ts.
     */
    export let height = 'h-4';
    export let width = 'w-full';
</script>

<div class="{height} {width} rounded bg-surface-300 dark:bg-surface-600 animate-pulse" aria-hidden="true"></div>
