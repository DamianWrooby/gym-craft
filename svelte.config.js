import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import adapter from '@sveltejs/adapter-netlify';
import path from 'path';
/** @type {import('@sveltejs/kit').Config} */

const config = {
    preprocess: [vitePreprocess({})],

    vitePlugin: {
        inspector: true,
    },
    kit: {
        adapter: adapter(),
        alias: {
            '@components': path.resolve('./src/lib/components'),
            '@lib': path.resolve('./src/lib'),
            '@utils': path.resolve('./src/lib/utils'),
            '@models': path.resolve('./src/models'),
        },
        prerender: {
            crawl: true,
            entries: [
                '/my-plans',
            ],
        },
    },
};
export default config;
