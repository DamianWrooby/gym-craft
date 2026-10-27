import '@testing-library/jest-dom/vitest';

// jsdom has no matchMedia; Skeleton reads it when it loads.
if (typeof window !== 'undefined' && !window.matchMedia) {
    window.matchMedia = (query) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
    });
}

// The app layout gives Skeleton's popup (InfoTooltip) its floating-ui functions; components under
// test need the same. Imported dynamically so the matchMedia stub above exists first.
if (typeof window !== 'undefined') {
    const { computePosition, autoUpdate, offset, shift, flip, arrow } = await import('@floating-ui/dom');
    const { storePopup } = await import('@skeletonlabs/skeleton');
    storePopup.set({ computePosition, autoUpdate, offset, shift, flip, arrow });
}
