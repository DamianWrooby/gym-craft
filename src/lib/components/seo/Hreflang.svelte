<script lang="ts">
    // Alternate-language links for a marketing page (ADR 0028): English at `/`, Polish at `/pl`.
    import { page } from '$app/stores';
    import { appConfig } from '@/constants/app.constants';
    import { SUPPORTED_LOCALES } from '@/constants/locale.constants';
    import { marketingPath } from '$lib/i18n/marketing-locale';

    const baseUrl = appConfig.baseUrlPROD as string;
    $: links = SUPPORTED_LOCALES.map((locale) => ({
        locale,
        href: `${baseUrl}${marketingPath($page.url.pathname, locale)}`,
    }));
</script>

<svelte:head>
    {#each links as link (link.locale)}
        <link rel="alternate" hreflang={link.locale} href={link.href} />
    {/each}
    <link rel="alternate" hreflang="x-default" href={`${baseUrl}${marketingPath($page.url.pathname, 'en')}`} />
</svelte:head>
