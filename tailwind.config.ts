import forms from '@tailwindcss/forms';
import typography from '@tailwindcss/typography';
import { join } from 'path';
import type { Config } from 'tailwindcss';
import { skeleton } from '@skeletonlabs/tw-plugin';

const config = {
    // 2. Opt for dark mode to be handled via the class method
    darkMode: 'class',
    content: [
        './src/**/*.{html,js,svelte,ts}',
        // 3. Append the path to the Skeleton package
        join(require.resolve('@skeletonlabs/skeleton'), '../**/*.{html,js,svelte,ts}'),
    ],
    theme: {
        extend: {},
    },
    plugins: [
        forms,
        typography,
        skeleton({
            themes: { preset: ['crimson'] },
        }),
    ],
    safelist: [
        'w-5',
        'w-10',
        'w-1/4',
        'xl:w-[50%]',
        'xl:w-[75%]',
        'xl:w-1/4',
        'text-surface-200',
        {
            pattern: /w-(1\/4|1\/2|\[50%\]|\[75%\])/,
            variants: ['md', 'xl'],
        },
    ],
} satisfies Config;

export default config;
