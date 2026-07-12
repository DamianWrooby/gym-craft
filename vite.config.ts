import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig, type Plugin } from 'vitest/config';
import { purgeCss } from 'vite-plugin-tailwind-purgecss';
import path from 'path';

// The app runs vite 4 (SvelteKit 1.x) while vitest 3 types its config against its own
// bundled vite 7, so the two Plugin types are structurally incompatible even though the
// plugins work at runtime. Bridge the type gap here until the vite/vitest versions align.
const plugins = [sveltekit(), purgeCss()] as unknown as Plugin[];

export default defineConfig({
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
            '@assets': path.resolve(__dirname, './src/assets'),
            '@components': path.resolve(__dirname, './src/lib/components'),
            '@models': path.resolve('./src/models'),
        },
    },
    plugins,
    test: {
        setupFiles: ['./vitest-setup.js'],
        include: ['src/**/*.{test,spec}.{js,ts}'],
        environment: 'jsdom',
    },
});
