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
        csrf: { checkOrigin: true },
        adapter: adapter(),
        alias: {
            '@components': path.resolve('./src/lib/components'),
            '@lib': path.resolve('./src/lib'),
            '@utils': path.resolve('./src/lib/utils'),
            '@models': path.resolve('./src/models'),
        },
        typescript: {
            // Kit 1.x emits options TypeScript has since removed or deprecated:
            // importsNotUsedAsValues/preserveValueImports were removed in TS 5.5 (TS5102) and
            // moduleResolution "node" (node10) is deprecated in TS 6. Swap them for their
            // replacements — the same values SvelteKit 2 generates.
            config: (tsconfig) => {
                delete tsconfig.compilerOptions.importsNotUsedAsValues;
                delete tsconfig.compilerOptions.preserveValueImports;
                delete tsconfig.compilerOptions.ignoreDeprecations;
                tsconfig.compilerOptions.verbatimModuleSyntax = true;
                tsconfig.compilerOptions.moduleResolution = 'bundler';
                return tsconfig;
            },
        },
    },
};
export default config;
