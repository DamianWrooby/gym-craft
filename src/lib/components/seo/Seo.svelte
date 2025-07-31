<script lang="ts">
    import { appConfig } from '@/constants/app.constants';
    import Screenshot from '$lib/images/gym-craft-app-ss.png';

    export let title = 'Personal trainer powered by AI | GymCraft™';
    export let metaDescription: string = 'Generate AI-powered personalized workout plans tailored to your goals, experience, and physical condition.';
    export let ogImage = Screenshot;

    const baseUrl = appConfig.baseUrlPROD as string;
</script>

<svelte:head>
    <title>{title}</title>
    <meta name="description" content={metaDescription} />
    <meta name="application-name" content="GymCraft" />

    <!-- Open Graph -->
    <meta property="og:site_name" content="GymCraft" />
    <meta property="og:description" content={metaDescription} />
    <meta property="og:title" content={title} />
    <meta property="og:image" content={baseUrl + ogImage} />
    <meta property="og:image:alt" content="GymCraft - Personal trainer application powered by AI" />

    <!-- Twitter Card -->
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={title} />
	<meta name="twitter:description" content={metaDescription} />
	<meta name="twitter:image" content={baseUrl + ogImage} />

    <link rel="canonical" href={baseUrl} />
</svelte:head>