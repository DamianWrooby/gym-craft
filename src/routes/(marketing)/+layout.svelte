<script lang="ts">
    import { setupViewTransitions } from '$lib/utils/view-transitions';
    import SiteFooter from '$lib/components/site-footer/SiteFooter.svelte';
    import '../../app.pcss';
    import { AppShell, AppBar, LightSwitch } from '@skeletonlabs/skeleton';
    import { initializeStores } from '@skeletonlabs/skeleton';
    import { Modal, Toast } from '@skeletonlabs/skeleton';
    import { HomeIcon } from 'svelte-feather-icons';
    import NavProgress from '$lib/components/loading/nav-progress/NavProgress.svelte';
    import Logo from '$lib/images/gym-craft-logo-crop.png';
    import { onMount } from 'svelte';
    import Banner from '$lib/components/banner/Banner.svelte';
    import { setCookie, getCookie } from '$lib/utils/cookies';
    import { cookieBannerOpened } from '@/stores';
    import { page } from '$app/stores';
    import { m } from '$lib/paraglide/messages.js';
    import { marketingLocale } from '$lib/i18n/marketing-locale';

    $: locale = marketingLocale($page.url.pathname) ?? null;

    initializeStores();
    setupViewTransitions();

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

    onMount(() => {
        checkCookieConsent();
    });
</script>

<Modal />
<Toast position={'br'} />
<NavProgress />

<AppShell>
    <svelte:fragment slot="header">
        <AppBar background="bg-primary-500">
            <svelte:fragment slot="lead">
                <a class="px-4 text-surface-500 hover:text-tertiary-500 block md:hidden" href="/app">
                    <HomeIcon />
                </a>
                <a class="px-4 text-surface-500 hover:text-tertiary-500 w-40 hidden md:block" href="/app">
                    <img width="241" height="68" class="m-auto" src={Logo} alt="Gym Craft Logo" />
                </a>
            </svelte:fragment>
            <svelte:fragment slot="trail">
                <nav class="flex items-center text-surface-500 font-semibold whitespace-nowrap">
                    <a class="px-4 hover:text-tertiary-500" href="/app/login">{m.mk_nav_login()}</a>
                    <a class="px-4 hover:text-tertiary-500" href="/app/register">{m.mk_nav_register()}</a>
                </nav>
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
        <SiteFooter marketingLocale={locale} />
    </svelte:fragment>
</AppShell>

{#if $cookieBannerOpened}
    <Banner title={m.mk_cookie_title()} message={m.mk_cookie_message()} on:accept={closeCookieBanner} />
{/if}
