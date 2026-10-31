import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ onNavigate: vi.fn() }));
vi.mock('$app/navigation', () => ({ onNavigate: mocks.onNavigate }));

import { setupViewTransitions } from './view-transitions';

type Callback = (navigation: { complete: Promise<void> }) => Promise<void> | void;

function registeredCallback(): Callback {
    setupViewTransitions();
    return mocks.onNavigate.mock.calls.at(-1)![0];
}

function mockReducedMotion(reduce: boolean) {
    window.matchMedia = vi.fn().mockReturnValue({ matches: reduce }) as never;
}

describe('setupViewTransitions', () => {
    afterEach(() => {
        delete (document as { startViewTransition?: unknown }).startViewTransition;
    });

    it('does nothing when the browser has no View Transitions API', () => {
        mockReducedMotion(false);
        expect(registeredCallback()({ complete: Promise.resolve() })).toBeUndefined();
    });

    it('does nothing when the user prefers reduced motion', () => {
        mockReducedMotion(true);
        const start = vi.fn();
        Object.assign(document, { startViewTransition: start });
        expect(registeredCallback()({ complete: Promise.resolve() })).toBeUndefined();
        expect(start).not.toHaveBeenCalled();
    });

    it('wraps the navigation in a view transition', async () => {
        mockReducedMotion(false);
        const start = vi.fn((cb: () => Promise<void>) => cb());
        Object.assign(document, { startViewTransition: start });
        await registeredCallback()({ complete: Promise.resolve() });
        expect(start).toHaveBeenCalledOnce();
    });
});
