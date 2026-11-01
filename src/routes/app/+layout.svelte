<script lang="ts">
    import { m } from '$lib/paraglide/messages.js';
    import { setupViewTransitions } from '$lib/utils/view-transitions';
    import SiteFooter from '$lib/components/site-footer/SiteFooter.svelte';
    import '../../app.pcss';
    import { AppShell, AppBar, LightSwitch } from '@skeletonlabs/skeleton';
    import Seo from '$lib/components/seo/Seo.svelte';
    import { page } from '$app/stores';
    import { initializeStores } from '@skeletonlabs/skeleton';
    import { Modal, Toast } from '@skeletonlabs/skeleton';
    import { HomeIcon } from 'svelte-feather-icons';
    import Navigation from '@components/navigation/Navigation.svelte';
    import NavProgress from '$lib/components/loading/nav-progress/NavProgress.svelte';
    import Logo from '$lib/images/gym-craft-logo-crop.png';
    import { onMount } from 'svelte';
    import { cookieBannerOpened } from '@/stores';
    import Banner from '$lib/components/banner/Banner.svelte';
    import { setCookie, getCookie } from '$lib/utils/cookies';
    import { computePosition, autoUpdate, offset, shift, flip, arrow } from '@floating-ui/dom';
    import { storePopup } from '@skeletonlabs/skeleton';

    $: user = $page.data.user;

    const initializePopups = () => {
        storePopup.set({ computePosition, autoUpdate, offset, shift, flip, arrow });
    };

    const closeCookieBanner = () => {
        setCookie('cookiesConsentAccepted', 'true', 100);
        cookieBannerOpened.update(() => false);
    };

    const checkCookieConsent = () => {
        if (!getCookie('cookiesConsentAccepted')) {
            cookieBannerOpened.update(() => true);
        } else {
            cookieBannerOpened.update(() => false);
        }
    };

    initializeStores();
    setupViewTransitions();
    initializePopups();

    onMount(() => {
        checkCookieConsent();
    });
</script>

<Seo
    title="Personal trainer powered by AI | GymCraft™"
    metaDescription="Verification link has been sent to the provided email." />

<Modal />
<Toast position={'br'} />
<NavProgress />

<AppShell>
    <svelte:fragment slot="header">
        <AppBar
            background="bg-primary-500"
            padding="px-2 py-3 sm:p-4"
            gap="gap-2 sm:gap-4"
            slotTrail="!space-x-1 sm:!space-x-4">
            <svelte:fragment slot="lead">
                <a class="px-2 sm:px-4 text-surface-500 hover:text-tertiary-500 block md:hidden" href="/app">
                    <HomeIcon />
                </a>
                <a class="px-4 text-surface-500 hover:text-tertiary-500 w-40 hidden md:block" href="/app">
                    <img width="241" height="68" class="m-auto" src={Logo} alt="Gym Craft Logo" />
                </a>
            </svelte:fragment>
            <svelte:fragment slot="trail">
                <Navigation {user}></Navigation>
                <LightSwitch></LightSwitch>
            </svelte:fragment>
        </AppBar>
    </svelte:fragment>
    <!-- Router Slot -->
    <!-- The outgoing page stays rendered and interactive during navigation; NavProgress
         is the only in-flight signal. Swapping in a spinner here blanked the page on
         every navigation, amplifying any server-load latency into blank-screen time. -->
    <slot />
    <!-- ---- / ---- -->
    <svelte:fragment slot="footer">
        <SiteFooter />
    </svelte:fragment>
</AppShell>

{#if $cookieBannerOpened}
    <Banner title={m.cookie_banner_title()} message={m.cookie_banner_message()} on:accept={closeCookieBanner} />
{/if}
