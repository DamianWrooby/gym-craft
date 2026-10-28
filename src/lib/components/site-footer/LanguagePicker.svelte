<script lang="ts">
    // Footer language picker for marketing pages (ADR 0028). A full reload, so every message on the
    // prerendered page, the layout included, renders in the new locale.
    import { page } from '$app/stores';
    import { m } from '$lib/paraglide/messages.js';
    import { getLocale } from '$lib/paraglide/runtime';
    import { LOCALE_NAMES, SUPPORTED_LOCALES } from '@/constants/locale.constants';
    import { marketingPath } from '$lib/i18n/marketing-locale';

    const current = getLocale();
</script>

<nav aria-label={m.mk_language_aria()}>
    <ul class="flex justify-center gap-x-3 pb-1 text-sm">
        {#each SUPPORTED_LOCALES as locale (locale)}
            <li>
                <a
                    href={marketingPath($page.url.pathname, locale)}
                    hreflang={locale}
                    lang={locale}
                    data-sveltekit-reload
                    aria-current={locale === current ? 'true' : undefined}
                    class="text-surface-200 hover:text-surface-300 hover:underline"
                    class:font-bold={locale === current}>{LOCALE_NAMES[locale]}</a>
            </li>
        {/each}
    </ul>
</nav>
