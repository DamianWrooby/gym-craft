<script lang="ts">
    import { onMount } from 'svelte';
    import { goto } from '$app/navigation';
    import { page } from '$app/stores';
    import { getModalStore } from '@skeletonlabs/skeleton';
    import type { ModalSettings } from '@skeletonlabs/skeleton';
    import { Edit2Icon, ArrowRightIcon } from 'svelte-feather-icons';
    import Logo from '$lib/images/gym-craft-logo-crop.png';
    import { getToastStore } from '@skeletonlabs/skeleton';
    import { makeToast } from '$lib/utils/toasts.js';

    const user = $page.data.user;
    const modalStore = getModalStore();
    const toastStore = getToastStore();

    const openEmailVerificationModal = () => {
        const modal: ModalSettings = {
            type: 'confirm',
            title: 'Email verification',
            body: `<p>Your account is not verified.</p>
                    <p>Verify email address to get full account functionality.</p>
                    <p>Click on the link provided in the email we sent you.</p>`,
            modalClasses: 'max-h-fit',
            buttonTextCancel: 'Cancel',
            buttonTextConfirm: 'Re-send verification email',
            response: async (response: boolean) => {
                if (response) {
                    try {
                        await resendVerificationEmail();
                    } catch (err) {
                        console.error(err);
                        makeToast(toastStore, 'Verification email has not been sent', 'variant-filled-error');
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
            makeToast(toastStore, 'Verification email has been sent', 'variant-filled-success');
        } else {
            makeToast(toastStore, 'Cannot send verification email. Try again later.', 'variant-filled-error');
        }
    };

    const onCreatePlan = () => {
        goto('/app/create-plan');
    };

    onMount(() => {
        checkEmailVerification();
    });
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
            {#if user && user.plansLeft > 0}
                <button on:click={() => onCreatePlan()} disabled={!user.emailVerified} class="btn variant-filled-primary group">
                    <Edit2Icon size="20" class="group-hover:animate-pulse" />
                    <span>Create training plan</span>
                </button>
                {#if !user.emailVerified}
                    <p class="text-warning-500 text-sm pt-3">Verify your email to create a plan</p>
                {/if}
            {:else if user && user.plansLeft <= 0}
                <h3 class="h3 text-lg text-center pb-3 text-warning-500">
                    <span>You have created maximum number of plans</span>
                </h3>
                <a href="/app/my-plans" class="btn variant-filled-primary group" data-sveltekit-preload-data="hover">
                    <ArrowRightIcon size="20" class="group-hover:animate-pulse" />
                    <span>Your plans</span>
                </a>
            {:else}
                <a href="/app/login" class="btn variant-filled-primary group" data-sveltekit-preload-data="hover">
                    <span>Log in</span>
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
