<script lang="ts">
    // Visual frame for the planner only (ADR 0018): cyberpunk direction in the GymCraft palette.
    export let fullscreen = false;

    // A click anywhere on a date field opens the calendar, not only on its small icon.
    function openDatePicker(e: MouseEvent) {
        const target = e.target as HTMLInputElement;
        if (target instanceof HTMLInputElement && target.type === 'date') target.showPicker?.();
    }
</script>

<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
<div class="gc-planner {fullscreen ? 'min-h-screen' : 'min-h-full'} px-4 py-6 md:px-8" on:click={openDatePicker}>
    <div class="mx-auto max-w-5xl space-y-4">
        <slot />
    </div>
</div>

<style>
    .gc-planner {
        background:
            linear-gradient(rgba(14, 165, 233, 0.05) 1px, transparent 1px) 0 0 / 100% 24px,
            radial-gradient(circle at 20% 0%, rgba(225, 29, 72, 0.18), transparent 50%),
            #0b0f17;
        color: #e2e8f0;
    }
    .gc-planner :global(.gc-panel) {
        background: rgba(15, 23, 42, 0.85);
        border: 1px solid rgba(148, 163, 184, 0.2);
        border-left: 3px solid #e11d48;
        border-radius: 0.25rem;
        box-shadow: 0 0 24px rgba(225, 29, 72, 0.08);
        clip-path: polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 0 100%);
    }
    /* A selectable card: dimmed until chosen. */
    .gc-planner :global(.gc-choice) {
        /* The cut corner cannot carry the selection border, so choice cards stay square. */
        clip-path: none;
        filter: saturate(0.25) brightness(0.8);
        transition:
            filter 150ms ease,
            border-color 150ms ease;
    }
    .gc-planner :global(.gc-choice:hover:not(:disabled)) {
        filter: saturate(0.6) brightness(0.9);
    }
    .gc-planner :global(.gc-choice[aria-pressed='true']) {
        filter: none;
        border-color: #38bdf8;
        border-left-color: #38bdf8;
        box-shadow:
            0 0 24px rgba(56, 189, 248, 0.35),
            inset 0 0 0 1px #38bdf8;
    }
    .gc-planner :global(.gc-stat) {
        background: rgba(2, 6, 23, 0.6);
        border: 1px solid rgba(56, 189, 248, 0.25);
        padding: 0.5rem 0.75rem;
    }
    .gc-planner :global(.gc-stat dt) {
        font-size: 0.7rem;
        text-transform: uppercase;
        letter-spacing: 0.15em;
        color: #94a3b8;
    }
    .gc-planner :global(.gc-stat dd) {
        font-size: 1.25rem;
        font-weight: 800;
        color: #7dd3fc;
    }
    .gc-planner :global(.gc-button) {
        background: linear-gradient(90deg, #be123c, #e11d48);
        color: white;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.15em;
        padding: 0.6rem 1.2rem;
        clip-path: polygon(8px 0, 100% 0, calc(100% - 8px) 100%, 0 100%);
    }
    .gc-planner :global(.gc-button:disabled) {
        filter: grayscale(1);
        opacity: 0.5;
        cursor: not-allowed;
    }
    .gc-planner :global(.gc-ghost) {
        border: 1px solid rgba(148, 163, 184, 0.4);
        color: #cbd5e1;
        padding: 0.6rem 1.2rem;
        text-transform: uppercase;
        letter-spacing: 0.15em;
        font-size: 0.8rem;
    }
    /* Checkboxes keep the forms plugin's check-mark image, so they only set background-color. */
    .gc-planner :global(input:not([type='checkbox']):not([type='radio'])),
    .gc-planner :global(select) {
        background: #020617;
        border: 1px solid rgba(148, 163, 184, 0.35);
        color: #e2e8f0;
        padding: 0.35rem 0.5rem;
        border-radius: 0.2rem;
    }
    /* Dark color scheme makes the native calendar icon and popup readable on the dark field. */
    .gc-planner :global(input[type='date']) {
        color-scheme: dark;
        cursor: pointer;
    }
    .gc-planner :global(input[type='checkbox']) {
        width: 1.1rem;
        height: 1.1rem;
        background-color: #020617;
        border: 1px solid rgba(148, 163, 184, 0.5);
        border-radius: 0.2rem;
        color: #38bdf8;
        cursor: pointer;
    }
    .gc-planner :global(input[type='checkbox']:checked) {
        background-color: #38bdf8;
        border-color: #38bdf8;
    }
    /* Shown while an AI request writes a week. */
    .gc-planner :global(.gc-pulse) {
        color: #e11d48;
        font-size: 2rem;
        animation: gc-pulse 1.2s ease-in-out infinite;
    }
    @keyframes gc-pulse {
        50% {
            opacity: 0.3;
            transform: scale(0.85);
        }
    }
    @media (prefers-reduced-motion: reduce) {
        .gc-planner :global(.gc-pulse) {
            animation: none;
        }
    }
</style>
