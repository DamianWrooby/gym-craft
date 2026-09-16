<script lang="ts">
    import { page } from '$app/stores';
    import { appConfig } from '@/constants/app.constants';
    import Screenshot from '$lib/images/gym-craft-app-ss.png';

    export let title = 'Personal trainer powered by AI | GymCraft™';
    export let metaDescription: string =
        'Generate AI-powered personalized workout plans tailored to your goals, experience, and physical condition.';
    export let ogImage = Screenshot;
    export let ogImageAlt = 'GymCraft - Personal trainer application powered by AI';

    // Always the production origin, even in dev: only production pages are read by social crawlers.
    const baseUrl = appConfig.baseUrlPROD as string;
    // Open Graph requires absolute image URLs; the imported asset is root-relative.
    $: ogImageUrl = /^https?:\/\//.test(ogImage) ? ogImage : `${baseUrl}${ogImage}`;
</script>

<svelte:head>
    <title>{title}</title>
    <meta name="description" content={metaDescription} />
    <meta name="application-name" content="GymCraft" />

    <!-- Open Graph -->
    <meta property="og:site_name" content="GymCraft" />
    <meta property="og:description" content={metaDescription} />
    <meta property="og:title" content={title} />
    <meta property="og:image" content={ogImageUrl} />
    <meta property="og:image:alt" content={ogImageAlt} />

    <!-- Twitter Card -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content={title} />
    <meta name="twitter:description" content={metaDescription} />
    <meta name="twitter:image" content={ogImageUrl} />

    <link rel="canonical" href={`${baseUrl}${$page.url.pathname}`} />
</svelte:head>
