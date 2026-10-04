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
    <h2 class="h2 text-center text-xl pb-8">Manage your account</h2>

    <div class="flex flex-col gap-6 max-w-2xl mx-auto">
        <section class="rounded-container-token border border-surface-500/40 p-5" aria-labelledby="account-heading">
            <div class="flex items-center gap-3 mb-4">
                <h3 id="account-heading" class="h3">Account</h3>
                {#if user.subscriptionTier === 'SUPPORTER'}
                    <SupporterBadge />
                {/if}
            </div>
            <dl class="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2">
                <dt class="opacity-75">Name</dt>
                <dd class="font-bold text-secondary-400 break-all">{user.name}</dd>
                {#if user.email}
                    <dt class="opacity-75">Email</dt>
                    <dd class="break-all">{user.email}</dd>
                {/if}
                <dt class="opacity-75">Generated plans</dt>
                <dd>{user.generatedPlansNumber}</dd>
                <dt class="opacity-75">Plans left</dt>
                <dd>{user.plansLeft}</dd>
            </dl>
            <a href="/app/profile" class="btn variant-soft-primary mt-5">
                <span>Edit athlete profile &amp; running goals</span>
                <span aria-hidden="true">→</span>
            </a>
        </section>

        <BillingPanel tier={user.subscriptionTier} />

        <section class="rounded-container-token border border-error-500/60 p-5" aria-labelledby="danger-heading">
            <h3 id="danger-heading" class="h3 text-error-500 mb-2">Danger zone</h3>
            <p class="mb-4 text-sm opacity-75">
                Deleting your account removes all your GymCraft data. You cannot undo this.
            </p>
            {#if !deleteAccountFormOpened}
                <button type="button" class="btn variant-filled-error" on:click={() => openDeleteAccountPanel()}>
                    <span>Delete my account</span>
                </button>
            {:else}
                <div transition:slide={{ duration: 200 }}>
                    <DeleteAccountForm data={formData} onSubmit={() => deleteAccount()} loading={isDeletionProcessed} />
                </div>
            {/if}
        </section>
    </div>
</Card>
