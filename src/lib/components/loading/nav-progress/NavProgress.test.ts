import { cleanup, render } from '@testing-library/svelte';
import { tick } from 'svelte';
import { writable } from 'svelte/store';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The component is driven entirely by the `navigating` store, so the store is the test's
// only input: a writable stand-in lets each case script an arbitrary navigation timeline.
vi.mock('$app/stores', () => ({ navigating: writable(null) }));

import { navigating } from '$app/stores';
import NavProgress from './NavProgress.svelte';

// Mirrors of the component's private constants — kept here so a change in the component
// shows up as a failing test rather than a silently-passing one.
const REVEAL_DELAY_MS = 150;
const COMPLETE_LINGER_MS = 200;
const CREEP_CEILING = 90;
const CREEP_TICK_MS = 120;

const navigation = (path: string) => ({ from: null, to: { url: new URL(`http://localhost${path}`) }, type: 'link' });

/** Advance the timer queue and then flush Svelte's pending reactive updates to the DOM. */
async function advance(ms: number) {
    vi.advanceTimersByTime(ms);
    await tick();
}

/** Point the component at a navigation (or `null` for "settled") and flush reactivity. */
async function navigateTo(value: ReturnType<typeof navigation> | null) {
    (navigating as ReturnType<typeof writable>).set(value);
    await tick();
}

function elements(container: HTMLElement) {
    const track = container.querySelector('.nav-progress-track') as HTMLElement;
    const bar = container.querySelector('.nav-progress-bar') as HTMLElement;
    return { track, bar, width: () => parseFloat(bar.style.width) };
}

describe('NavProgress', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        (navigating as ReturnType<typeof writable>).set(null);
    });

    afterEach(() => {
        cleanup();
        vi.useRealTimers();
    });

    it('starts hidden and empty with no timers pending', () => {
        const { container } = render(NavProgress);
        const { track, width } = elements(container);

        expect(track).not.toHaveClass('is-visible');
        expect(width()).toBe(0);
        expect(vi.getTimerCount()).toBe(0);
    });

    it('never reveals the bar for a navigation that resolves inside the reveal delay', async () => {
        const { container } = render(NavProgress);
        const { track, width } = elements(container);

        await navigateTo(navigation('/app/running/analytics'));
        expect(vi.getTimerCount()).toBe(1); // reveal timer armed, nothing shown yet

        await advance(REVEAL_DELAY_MS - 1);
        expect(track).not.toHaveClass('is-visible');
        expect(width()).toBe(0);

        await navigateTo(null);
        expect(track).not.toHaveClass('is-visible');
        expect(width()).toBe(0);
        expect(vi.getTimerCount()).toBe(0);

        // Well past every delay the component knows about: still nothing flashes.
        await advance(REVEAL_DELAY_MS + COMPLETE_LINGER_MS + CREEP_TICK_MS);
        expect(track).not.toHaveClass('is-visible');
        expect(width()).toBe(0);
    });

    it('reveals the bar once the navigation outlives the reveal delay', async () => {
        const { container } = render(NavProgress);
        const { track, width } = elements(container);

        await navigateTo(navigation('/app/running/reports'));
        await advance(REVEAL_DELAY_MS);

        expect(track).toHaveClass('is-visible');
        expect(width()).toBe(8);
    });

    it('creeps toward the ceiling without ever claiming completion while in flight', async () => {
        const { container } = render(NavProgress);
        const { width } = elements(container);

        await navigateTo(navigation('/app/running/reports'));
        await advance(REVEAL_DELAY_MS);

        let previous = width();
        for (let i = 0; i < 3; i++) {
            await advance(CREEP_TICK_MS);
            expect(width()).toBeGreaterThan(previous);
            expect(width()).toBeLessThanOrEqual(CREEP_CEILING);
            previous = width();
        }

        // A pathologically long navigation: the bar stalls at the ceiling, never at 100.
        await advance(CREEP_TICK_MS * 200);
        expect(width()).toBe(CREEP_CEILING);
        expect(width()).toBeLessThan(100);
    });

    it('fills to 100 on completion and hides after the linger delay', async () => {
        const { container } = render(NavProgress);
        const { track, width } = elements(container);

        await navigateTo(navigation('/app/running/reports'));
        await advance(REVEAL_DELAY_MS + CREEP_TICK_MS);
        expect(track).toHaveClass('is-visible');

        await navigateTo(null);
        expect(width()).toBe(100);
        expect(track).toHaveClass('is-visible');

        await advance(COMPLETE_LINGER_MS - 1);
        expect(track).toHaveClass('is-visible');
        expect(width()).toBe(100);

        await advance(1);
        expect(track).not.toHaveClass('is-visible');
        expect(width()).toBe(0);
        expect(vi.getTimerCount()).toBe(0);
    });

    it('clears the creep interval on destroy', async () => {
        const { container, unmount } = render(NavProgress);

        await navigateTo(navigation('/app/running/reports'));
        await advance(REVEAL_DELAY_MS);
        expect(vi.getTimerCount()).toBe(1); // the creep interval
        expect(elements(container).track).toHaveClass('is-visible');

        unmount();
        expect(vi.getTimerCount()).toBe(0);
    });

    it('clears the reveal timer when destroyed mid-delay', async () => {
        const { unmount } = render(NavProgress);

        await navigateTo(navigation('/app/running/reports'));
        expect(vi.getTimerCount()).toBe(1);

        unmount();
        expect(vi.getTimerCount()).toBe(0);
    });

    it('clears the hide timer when destroyed during the linger', async () => {
        const { unmount } = render(NavProgress);

        await navigateTo(navigation('/app/running/reports'));
        await advance(REVEAL_DELAY_MS);
        await navigateTo(null);
        expect(vi.getTimerCount()).toBe(1); // the hide timer

        unmount();
        expect(vi.getTimerCount()).toBe(0);
    });

    it('does not leak timers when a navigation starts while another is in flight', async () => {
        const { container } = render(NavProgress);
        const { width } = elements(container);

        await navigateTo(navigation('/app/running/reports'));
        await advance(REVEAL_DELAY_MS + CREEP_TICK_MS * 2);
        const crept = width();
        expect(crept).toBeGreaterThan(8);

        // Redirect chain: a second navigation supersedes the first with no settled state between.
        await navigateTo(navigation('/app/login'));
        expect(vi.getTimerCount()).toBe(1); // only the new reveal timer — the old creep is gone

        // The superseding navigation restarts the creep from the beginning rather than
        // resuming the stale value.
        await advance(REVEAL_DELAY_MS);
        expect(width()).toBe(8);
        expect(vi.getTimerCount()).toBe(1);

        await navigateTo(null);
        await advance(COMPLETE_LINGER_MS);
        expect(elements(container).track).not.toHaveClass('is-visible');
        expect(vi.getTimerCount()).toBe(0);
    });

    it('settles cleanly when a redirect chain resolves before the bar is ever revealed', async () => {
        const { container } = render(NavProgress);
        const { track, width } = elements(container);

        await navigateTo(navigation('/app'));
        await advance(REVEAL_DELAY_MS - 50);
        await navigateTo(navigation('/app/login'));
        await advance(REVEAL_DELAY_MS - 50);
        await navigateTo(null);

        expect(track).not.toHaveClass('is-visible');
        expect(width()).toBe(0);
        expect(vi.getTimerCount()).toBe(0);
    });
});
