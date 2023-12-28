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
    },
    plugins: [sveltekit(), purgeCss()],
    test: {
        include: ['src/**/*.{test,spec}.{js,ts}'],
    },
});
