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
        // CSRF origin check on cross-site form POSTs. In kit 2 `csrf.checkOrigin` is deprecated
        // in favour of `csrf.trustedOrigins` (see @sveltejs/kit config options.js). checkOrigin
        // still defaults to true, so an empty trustedOrigins list = strict same-origin with no
        // exceptions — behaviourally identical to the old `checkOrigin: true`.
        csrf: { trustedOrigins: [] },
        adapter: adapter(),
        alias: {
            '@components': path.resolve('./src/lib/components'),
            '@lib': path.resolve('./src/lib'),
            '@utils': path.resolve('./src/lib/utils'),
            '@models': path.resolve('./src/models'),
        },
    },
};
export default config;
