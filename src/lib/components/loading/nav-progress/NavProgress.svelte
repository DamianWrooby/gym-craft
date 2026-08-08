<script lang="ts">
    import { navigating } from '$app/stores';
    import { onDestroy } from 'svelte';

    /**
     * Thin top-of-viewport progress bar for client-side navigations.
     *
     * Deliberately does NOT hide the current page: SvelteKit keeps the outgoing page
     * rendered and interactive until the new data lands, so blanking it (as the old
     * `{#if $navigating}<Spinner/>` did) turned every navigation into a content flash.
     */

    /** Navigations that resolve faster than this never reveal the bar at all. */
    const REVEAL_DELAY_MS = 150;
    /** How long the filled bar lingers at 100% before fading out. */
    const COMPLETE_LINGER_MS = 200;
    /** The bar creeps toward this and stalls — it must never claim completion early. */
    const CREEP_CEILING = 90;
    const CREEP_TICK_MS = 120;

    let visible = false;
    let progress = 0;

    let revealTimer: ReturnType<typeof setTimeout> | undefined;
    let creepTimer: ReturnType<typeof setInterval> | undefined;
    let hideTimer: ReturnType<typeof setTimeout> | undefined;

    function clearTimers() {
        clearTimeout(revealTimer);
        clearInterval(creepTimer);
        clearTimeout(hideTimer);
        revealTimer = undefined;
        creepTimer = undefined;
        hideTimer = undefined;
    }

    function start() {
        clearTimers();
        revealTimer = setTimeout(() => {
            visible = true;
            progress = 8;
            // Ease toward the ceiling: fast at first, asymptotic after, so a long
            // navigation still looks alive without ever reaching the end.
            creepTimer = setInterval(() => {
                progress = Math.min(CREEP_CEILING, progress + Math.max(0.4, (CREEP_CEILING - progress) * 0.12));
            }, CREEP_TICK_MS);
        }, REVEAL_DELAY_MS);
    }

    function finish() {
        clearTimers();
        if (!visible) {
            // Resolved inside the reveal delay — nothing was ever shown, so show nothing.
            progress = 0;
            return;
        }
        progress = 100;
        hideTimer = setTimeout(() => {
            visible = false;
            progress = 0;
        }, COMPLETE_LINGER_MS);
    }

    $: if ($navigating) start();
    else finish();

    onDestroy(clearTimers);
</script>

<!--
    aria-hidden: the navigation itself is what assistive tech should announce (via the
    page change), not a continuously-updating numeric progress value.
-->
<div class="nav-progress-track" class:is-visible={visible} aria-hidden="true">
    <div class="nav-progress-bar bg-surface-50" style="width: {progress}%"></div>
</div>

<style>
    .nav-progress-track {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        height: 2px;
        z-index: 999;
        pointer-events: none;
        opacity: 0;
        transition: opacity 150ms ease-out;
    }

    .nav-progress-track.is-visible {
        opacity: 1;
    }

    .nav-progress-bar {
        height: 100%;
        width: 0;
        border-radius: 0 2px 2px 0;
        transition: width 120ms ease-out;
    }

    @media (prefers-reduced-motion: reduce) {
        .nav-progress-track,
        .nav-progress-bar {
            transition: none;
        }
    }
</style>
