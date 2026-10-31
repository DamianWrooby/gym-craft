<script lang="ts">
    import { m } from '$lib/paraglide/messages.js';
    import { onMount } from 'svelte';
    import { page } from '$app/stores';
    import { getModalStore } from '@skeletonlabs/skeleton';
    import type { ModalSettings } from '@skeletonlabs/skeleton';
    import { ArrowRightIcon } from 'svelte-feather-icons';
    import Logo from '$lib/images/gym-craft-logo-crop.png';
    import { getToastStore } from '@skeletonlabs/skeleton';
    import { makeToast } from '$lib/utils/toasts.js';
    import SportIcon from '@components/sport-icon/SportIcon.svelte';

    const user = $page.data.user;
    const modalStore = getModalStore();
    const toastStore = getToastStore();

    const openEmailVerificationModal = () => {
        const modal: ModalSettings = {
            type: 'confirm',
            title: m.home_verify_title(),
            body: `<p>${m.home_verify_body_1()}</p><p>${m.home_verify_body_2()}</p><p>${m.home_verify_body_3()}</p>`,
            modalClasses: 'max-h-fit',
            buttonTextCancel: m.common_cancel(),
            buttonTextConfirm: m.home_verify_resend(),
            response: async (response: boolean) => {
                if (response) {
                    try {
                        await resendVerificationEmail();
                    } catch (err) {
                        console.error(err);
                        makeToast(toastStore, m.home_verify_not_sent(), 'variant-filled-error');
                    }
                }
            },
        };
        modalStore.trigger(modal);
    };

    const checkEmailVerification = () => {
        if (user && !user.emailVerified) {
            openEmailVerificationModal();
        }
    };

    const resendVerificationEmail = async () => {
        const body = JSON.stringify({ email: user.email });

        const response: Response = await fetch(`/api/email-verification/${user.id}`, {
            method: 'POST',
            body,
        });

        if (response.ok) {
            makeToast(toastStore, m.home_verify_sent(), 'variant-filled-success');
        } else {
            makeToast(toastStore, m.home_verify_failed(), 'variant-filled-error');
        }
    };

    onMount(() => {
        checkEmailVerification();
    });
</script>

<section class="relative overflow-hidden h-full w-full flex flex-col md:flex-row items-center justify-center">
    <div class="z-10 md:w-1/2">
        <div class="flex flex-col items-center justify-center p-5 pt-10">
            <img loading="lazy" width="241" height="68" class="pt-5" src={Logo} alt="Gym Craft Logo" />
            <h1 class="h1 inline-block">
                <span
                    class="bg-gradient-to-br from-primary-500 to-surface-400 bg-clip-text text-transparent box-decoration-clone uppercase text-base"
                    >{m.home_tagline()}</span>
            </h1>
        </div>
        <div class="p-5 text-center">
            {#if user}
                <p class="text-surface-500 dark:text-surface-300 text-sm pb-4">{m.home_choose_sport()}</p>
                <div class="flex flex-col sm:flex-row items-stretch justify-center gap-3 sm:gap-4">
                    <a
                        href="/app/gym"
                        data-sveltekit-preload-data="hover"
                        class="group card variant-soft-surface hover:variant-soft-tertiary transition-colors p-5 flex flex-col items-center gap-2 no-underline min-w-[140px]">
                        <span class="text-tertiary-500 group-hover:text-tertiary-400">
                            <SportIcon sport="gym" size={36} />
                        </span>
                        <span class="font-semibold">{m.nav_gym()}</span>
                        <span class="text-xs text-surface-500 dark:text-surface-300 flex items-center gap-1">
                            {m.home_open()}
                            <ArrowRightIcon size="12" />
                        </span>
                    </a>
                    <a
                        href="/app/running"
                        data-sveltekit-preload-data="hover"
                        class="group card variant-soft-surface hover:variant-soft-tertiary transition-colors p-5 flex flex-col items-center gap-2 no-underline min-w-[140px]">
                        <span class="text-tertiary-500 group-hover:text-tertiary-400">
                            <SportIcon sport="running" size={36} />
                        </span>
                        <span class="font-semibold">{m.nav_running()}</span>
                        <span class="text-xs text-surface-500 dark:text-surface-300 flex items-center gap-1">
                            {m.home_open()}
                            <ArrowRightIcon size="12" />
                        </span>
                    </a>
                </div>
                {#if !user.emailVerified}
                    <p class="text-warning-500 text-sm pt-4">{m.home_verify_to_plan()}</p>
                {/if}
            {:else}
                <a href="/app/login" class="btn variant-filled-primary group" data-sveltekit-preload-data="hover">
                    <span>{m.login_submit()}</span>
                </a>
            {/if}
        </div>
    </div>
    <div class="bg-img absolute w-full h-full top-0 left-0 bg-surface-700 z-0 md:w-1/2 md:relative"></div>
</section>

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
            background-size: 110vh;
        }
        to {
            background-size: 180vh;
        }
    }
</style>
