import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';
import { purgeCss } from 'vite-plugin-tailwind-purgecss';
import path from 'path';

export default defineConfig({
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
            '@assets': path.resolve(__dirname, './src/assets'),
            '@components': path.resolve(__dirname, './src/lib/components'),
            '@models': path.resolve('./src/models'),
        },
        // Vitest runs in node, so without this vite-plugin-svelte hands it the SSR build of every
        // component — and onMount never runs under SSR. Mount-time behaviour would then silently
        // do nothing in tests while working fine in the browser. Scoped to vitest so the real
        // build keeps its own resolution.
        ...(process.env.VITEST ? { conditions: ['browser'] } : {}),
    },
    plugins: [sveltekit(), purgeCss()],
    test: {
        setupFiles: ['./vitest-setup.js'],
        include: ['src/**/*.{test,spec}.{js,ts}'],
        environment: 'jsdom',
    },
});
