<script lang="ts">
    import { page } from '$app/stores';
    import { cookieBannerOpened } from '@/stores';
    import { Edit2Icon, ArrowRightIcon } from 'svelte-feather-icons';
    import { appConfig } from '@/constants/app.constants';
    import Logo from '$lib/images/gym-craft-logo-crop.png';
    import BackgroundImg from '$lib/images/gym-craft-ai-7.jpg';
    import Banner from '$lib/components/banner/Banner.svelte';

    const user = $page.data.user;

    const closeCookieBanner = () => {
        cookieBannerOpened.update(() => false);
    };
</script>

<section class="relative overflow-hidden h-full w-full flex flex-col md:flex-row items-center justify-center">
    <div class="z-10 md:w-1/2">
        <div class="flex flex-col items-center justify-center p-5 pt-10">
            <img class="pt-5" src={Logo} alt="Gym Craft Logo" />
            <h1 class="h1 inline-block">
                <span
                    class="bg-gradient-to-br from-primary-500 to-surface-400 bg-clip-text text-transparent box-decoration-clone uppercase text-base"
                    >AI powered personal trainer</span>
            </h1>
        </div>
        <div class="p-5 text-center">
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
        </div>
    </div>
    <div class="bg-img absolute w-full h-full top-0 left-0 bg-surface-700 z-0 md:w-1/2 md:relative"></div>
</section>

{#if $cookieBannerOpened}
    <Banner
        title={'Cookie Consent'}
        message={"This web application uses cookies to keep user's session. By continuing to browse or by clicking 'Accept', you agree to the storing of cookies on your device."}
        on:accept={closeCookieBanner} />
{/if}

<style>
    .h1 {
        line-height: 0;
    }

    .bg-img {
        background-image: url('/src/lib/images/gym-craft-ai-7.jpg');
        background-size: cover;
        background-position: top;
        background-blend-mode: overlay;
        background-repeat: no-repeat;
        transform: scalex(-1);
        filter: brightness(0.4) hue-rotate(20deg) grayscale(0.7);
        animation: slidein 90s;
        animation-fill-mode: forwards;
        animation-iteration-count: infinite;
        animation-direction: alternate;
    }

    @keyframes slidein {
        from {
            background-size: 100vh;
        }
        to {
            background-size: 150vh;
        }
    }
</style>
