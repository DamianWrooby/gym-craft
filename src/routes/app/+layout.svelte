<script lang="ts">
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
        <AppBar background="bg-primary-500">
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
    <Banner
        title={'Cookie Consent'}
        message={"This web application uses cookies to keep user's session. By continuing to browse or by clicking 'Accept', you agree to the storing of cookies on your device."}
        on:accept={closeCookieBanner} />
{/if}
