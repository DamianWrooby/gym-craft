<script lang="ts">
    import '../../app.pcss';
    import { AppShell, AppBar, LightSwitch } from '@skeletonlabs/skeleton';
    import { page, navigating } from '$app/stores';
    import { initializeStores } from '@skeletonlabs/skeleton';
    import { Modal, Toast } from '@skeletonlabs/skeleton';
    import { HomeIcon } from 'svelte-feather-icons';
    import Navigation from '@components/navigation/Navigation.svelte';
    import Spinner from '$lib/components/loading/spinner/Spinner.svelte';
    import Logo from '$lib/images/gym-craft-logo-crop.png';
    import Screenshot from '$lib/images/gym-craft-app-ss.png';

    const currentDate = new Date();
    $: user = $page.data.user;

    initializeStores();
</script>

<svelte:head>
    <title>Gym Craft - Personal trainer powered by AI</title>
    <meta property="og:image" content={Screenshot}>
    <meta property="og:image:alt" content="Gym Craft - Personal trainer application powered by AI">
</svelte:head>

<Modal />
<Toast position={'br'} />

<AppShell>
    <svelte:fragment slot="header">
        <AppBar background="bg-primary-500">
            <svelte:fragment slot="lead">
                <a class="px-4 text-surface-500 hover:text-tertiary-500 block md:hidden" href="/">
                    <HomeIcon />
                </a>
                <a class="px-4 text-surface-500 hover:text-tertiary-500 w-40 hidden md:block" href="/">
                    <img class="m-auto" src={Logo} alt="Gym Craft Logo" />
                </a>
            </svelte:fragment>
            <svelte:fragment slot="trail">
                <Navigation {user}></Navigation>
                <LightSwitch></LightSwitch>
            </svelte:fragment>
        </AppBar>
    </svelte:fragment>
    <!-- Router Slot -->
    {#if $navigating}
        <Spinner size={10} />
    {:else}
        <slot />
    {/if}
    <!-- ---- / ---- -->
    <svelte:fragment slot="footer">
        <div class="bg-primary-500 text-surface-500 text-center py-4 font-semibold">
            © {currentDate.getFullYear()} GYM CRAFT - Your AI powered personal trainer
        </div>
    </svelte:fragment>
</AppShell>
