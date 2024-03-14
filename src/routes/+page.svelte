<script lang="ts">
    import { page } from '$app/stores';
    import { cookieBannerOpened } from '@/stores';
    import { Edit2Icon, ArrowRightIcon } from 'svelte-feather-icons';
    import { appConfig } from '@/constants/app.constants';
    import Logo from '$lib/images/gym-craft-logo-crop.png';
    import Banner from '$lib/components/banner/Banner.svelte';

    const user = $page.data.user;

    const closeCookieBanner = () => {
        cookieBannerOpened.update(() => false);
    };
</script>

<div class="h-full flex flex-col items-center justify-center">
        <section class="p-5 pt-10">
            <img class="m-auto py-5" src={Logo} alt="Gym Craft Logo" />
            <h2 class="h1 text-lg text-center">
                <span>AI powered personal trainer</span>
            </h2>
        </section>
        <section class="p-5 text-center">
            {#if user && user.generatedPlansNumber < appConfig.planLimit}
                <a href="/create-plan" class="btn variant-filled-primary group">
                    <Edit2Icon size="20" class="group-hover:animate-pulse" />
                    <span>Create training plan</span>
                </a>
            {:else if user && user.generatedPlansNumber >= appConfig.planLimit}
                <h3 class="h3 text-lg text-center pb-3 text-warning-500">
                    <span>You have created maximum number of plans</span>
                </h3>
                <a href="/my-plans" class="btn variant-filled-primary group">
                    <ArrowRightIcon size="20" class="group-hover:animate-pulse" />
                    <span>Your plans</span>
                </a>
            {:else}
                <a href="/login" class="btn variant-filled-primary group">
                    <span>Log in</span>
                </a>
            {/if}
        </section>
    </div>

{#if $cookieBannerOpened}
    <Banner
        title={'Cookie Consent'}
        message={"This web application uses cookies to keep user's session. By continuing to browse or by clicking 'Accept', you agree to the storing of cookies on your device."}
        on:accept={closeCookieBanner} />
{/if}
