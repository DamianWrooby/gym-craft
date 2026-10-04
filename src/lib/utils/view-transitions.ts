import { onNavigate } from '$app/navigation';

type StartViewTransition = (callback: () => Promise<void>) => unknown;

// Cross-fades between pages with the browser View Transitions API. Browsers without
// the API, and users who prefer reduced motion, get the plain instant swap.
// Must be called during component initialisation (it registers onNavigate).
export function setupViewTransitions(): void {
    onNavigate((navigation) => {
        const start = (document as Document & { startViewTransition?: StartViewTransition }).startViewTransition;
        if (!start || prefersReducedMotion()) return;

        return new Promise<void>((resolve) => {
            start.call(document, async () => {
                resolve();
                await navigation.complete;
            });
        });
    });
}

function prefersReducedMotion(): boolean {
    return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}
