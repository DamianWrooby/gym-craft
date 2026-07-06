<script lang="ts">
    import { page } from '$app/stores';
    import { onMount } from 'svelte';
    import { slide } from 'svelte/transition';
    import type { User } from '@/models/user/user.model';
    import DeleteAccountForm from '$lib/components/delete-account-form/DeleteAccountForm.svelte';
    import { getToastStore } from '@skeletonlabs/skeleton';
    import { makeToast } from '$lib/utils/toasts.js';
    import Card from '@components/card/Card.svelte';
    import { goto, invalidateAll } from '$app/navigation';
    import BillingPanel from '$lib/components/billing/BillingPanel.svelte';
    import SupporterBadge from '$lib/components/billing/SupporterBadge.svelte';

    // Reactive: the tier flips without a manual reload after the post-checkout invalidateAll.
    $: user = $page.data.user as User;
    const formData = { password: '' };
    const toastStore = getToastStore();
    let deleteAccountFormOpened = false;
    let isDeletionProcessed = false;

    onMount(() => {
        const checkout = $page.url.searchParams.get('checkout');
        if (!checkout) return;

        if (checkout === 'success') {
            makeToast(
                toastStore,
                'Thank you for supporting GymCraft! 🎉 <br> Your Supporter perks are activating — this can take a few seconds.',
                'variant-filled-success',
            );
            // Stripe redirects back before the webhook lands; refresh page data shortly so the tier flips.
            setTimeout(() => invalidateAll(), 2500);
        } else if (checkout === 'cancel') {
            makeToast(toastStore, 'Checkout canceled — you have not been charged.', 'variant-filled-surface');
        }

        // Strip the query param so a page refresh does not repeat the toast.
        goto('/app/my-account', { replaceState: true, noScroll: true });
    });

    const openDeleteAccountPanel = () => {
        deleteAccountFormOpened = true;
    };

    const deleteAccount = async () => {
        isDeletionProcessed = true;

        const password = formData.password;

        try {
            const response: Response = await fetch(`/api/user`, {
                method: 'DELETE',
                body: JSON.stringify({
                    password,
                }),
            });
            const { message } = await response.json();

            if (response.ok) {
                makeToast(toastStore, message, 'variant-filled-success');
                goto('/app');
            } else {
                makeToast(toastStore, message, 'variant-filled-error');
            }
        } catch (err) {
            console.error({ err });
            makeToast(toastStore, 'Verification email has not been sent', 'variant-filled-error');
            makeToast(toastStore, err as string, 'variant-filled-error');
        }

        isDeletionProcessed = false;
    };
</script>

<Card>
    <h2 class="h2 text-center text-xl py-10">Manage your account</h2>
    <p>
        Name: <span class="text-secondary-400 font-bold">{user.name}</span>
        {#if user.subscriptionTier === 'SUPPORTER'}
            <SupporterBadge />
        {/if}
    </p>
    <p>Generated plans number: {user.generatedPlansNumber}</p>
    <p>Plans left: {user.plansLeft}</p>
    <BillingPanel tier={user.subscriptionTier} />
    <div class="flex justify-center mt-8">
        <a href="/app/profile" class="btn variant-soft-primary">
            <span>Edit athlete profile &amp; running goals</span>
            <span aria-hidden="true">→</span>
        </a>
    </div>
    <div class="relative flex flex-col justify-center mt-8 border rounded border-solid border-red-500">
        <div class="absolute top-0">
            <p class="text-red-500 font-thin pl-1">Danger zone</p>
        </div>
        {#if !deleteAccountFormOpened}
            <div class="flex justify-center p-5">
                <button type="button" class="btn variant-filled-error" on:click={() => openDeleteAccountPanel()}>
                    <span>Delete my account</span>
                </button>
            </div>
        {:else}
            <section class="flex justify-center" transition:slide={{ duration: 200 }}>
                <DeleteAccountForm data={formData} onSubmit={() => deleteAccount()} loading={isDeletionProcessed} />
            </section>
        {/if}
    </div>
</Card>
