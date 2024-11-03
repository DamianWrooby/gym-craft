<script lang="ts">
	import Screenshot from '$lib/images/gym-craft-app-ss.png';

	export let title = 'Personal trainer powered by AI | GymCraft™';
	export let metaDescription: string;
	export let ogImage = Screenshot;
</script>

<svelte:head>
    <title>{title}</title>
	{#if metaDescription}
		<meta name="description" content={metaDescription}>
	{/if}
    <meta property="og:title" content={title} />
    <meta property="og:image" content={ogImage} />
    <meta property="og:image:alt" content="GymCraft - Personal trainer application powered by AI" />
</svelte:head>