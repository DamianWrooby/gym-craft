import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';
import { purgeCss } from 'vite-plugin-tailwind-purgecss';
import path from 'path';
import { paraglideVitePlugin } from '@inlang/paraglide-js';

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
    plugins: [
        paraglideVitePlugin({
            project: './project.inlang',
            outdir: './src/lib/paraglide',
            // Keep in sync with the i18n:compile script in package.json.
            // Marketing: the URL prefix. Server: the hook's resolved locale (ADR 0028). Browser: the cookie
            // the hook mirrors it into.
            strategy: ['custom-marketing', 'custom-resolved', 'cookie', 'baseLocale'],
        }),
        sveltekit(),
        purgeCss(),
    ],
    test: {
        setupFiles: ['./vitest-setup.js'],
        include: ['src/**/*.{test,spec}.{js,ts}'],
        environment: 'jsdom',
    },
});
