<script lang="ts">
    import { HelpCircleIcon } from 'svelte-feather-icons';
    import { popup, type PopupSettings } from '@skeletonlabs/skeleton';

    export let id: string;
    export let ariaLabel = 'More info';
    export let placement: PopupSettings['placement'] = 'top';

    $: settings = {
        event: 'hover',
        target: id,
        placement,
    } satisfies PopupSettings;
</script>

<button
    type="button"
    class="info-tooltip-trigger inline-flex items-center justify-center w-4 h-4 p-0 opacity-50 hover:opacity-100 cursor-help leading-none"
    aria-label={ariaLabel}
    use:popup={settings}>
    <HelpCircleIcon size="12" />
</button>

<div class="card p-3 variant-filled-secondary text-xs leading-snug max-w-xs z-50 shadow-lg" data-popup={id}>
    <slot />
    <div class="arrow variant-filled-secondary" />
</div>

<style>
    .info-tooltip-trigger :global(svg) {
        pointer-events: none;
    }
</style>
