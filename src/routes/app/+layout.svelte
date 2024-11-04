<script lang="ts">
    import '../../app.pcss';
    import { AppShell, AppBar, LightSwitch } from '@skeletonlabs/skeleton';
    import Seo from '$lib/components/seo/Seo.svelte';
    import { page, navigating } from '$app/stores';
    import { initializeStores } from '@skeletonlabs/skeleton';
    import { Modal, Toast } from '@skeletonlabs/skeleton';
    import { HomeIcon } from 'svelte-feather-icons';
    import Navigation from '@components/navigation/Navigation.svelte';
    import Spinner from '$lib/components/loading/spinner/Spinner.svelte';
    import Logo from '$lib/images/gym-craft-logo-crop.png';
    import { onMount } from 'svelte';
    import { cookieBannerOpened } from '@/stores';
    import Banner from '$lib/components/banner/Banner.svelte';
    import { setCookie, getCookie } from '$lib/utils/cookies';

    const currentDate = new Date();
    $: user = $page.data.user;

    initializeStores();

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

<Seo title="Personal trainer powered by AI | GymCraft™"
    metaDescription="Verification link has been sent to the provided email." />

<Modal />
<Toast position={'br'} />

<AppShell>
    <svelte:fragment slot="header">
        <AppBar background="bg-primary-500">
            <svelte:fragment slot="lead">
                <a class="px-4 text-surface-500 hover:text-tertiary-500 block md:hidden" href="/app">
                    <HomeIcon />
                </a>
                <a class="px-4 text-surface-500 hover:text-tertiary-500 w-40 hidden md:block" href="/app">
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
        <div class="hidden sm:block bg-primary-500 font-thin text-center py-2 font-semibold">
            © {currentDate.getFullYear()} <span class="font-bold">GymCraft</span> - Your AI powered personal trainer by
            <a href="https://github.com/DamianWrooby" target="_blank" rel="noopener noreferrer"
                ><span class="text-surface-200 hover:text-surface-300 font-semibold">Wrooby</span></a>
        </div>
        <div class="block sm:hidden bg-primary-500 font-thin text-center py-2 font-semibold">
            © {currentDate.getFullYear()} <span class="font-bold">GymCraft</span>
        </div>
    </svelte:fragment>
</AppShell>

{#if $cookieBannerOpened}
    <Banner
        title={'Cookie Consent'}
        message={"This web application uses cookies to keep user's session. By continuing to browse or by clicking 'Accept', you agree to the storing of cookies on your device."}
        on:accept={closeCookieBanner} />
{/if}
