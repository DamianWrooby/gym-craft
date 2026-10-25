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
    import { getLimit } from '@/constants/subscription.constants';
    import { PUBLIC_APP_ENV } from '$env/static/public';
    import { enabledLocales, LOCALE_NAMES } from '@/constants/locale.constants';
    import { m } from '$lib/paraglide/messages.js';

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

    $: allowedModels = getLimit(user.subscriptionTier, 'allowedModels');
    let isModelSaving = false;

    const saveAiModel = async (event: Event) => {
        const model = (event.currentTarget as HTMLSelectElement).value;
        isModelSaving = true;
        try {
            const response = await fetch(`/api/user/${user.id}/ai-model`, {
                method: 'PUT',
                body: JSON.stringify({ model }),
            });
            if (response.ok) {
                makeToast(toastStore, 'AI model saved.', 'variant-filled-success');
                await invalidateAll();
            } else {
                const { message } = await response.json();
                makeToast(toastStore, message, 'variant-filled-error');
            }
        } catch (err) {
            console.error({ err });
            makeToast(toastStore, 'The AI model has not been saved.', 'variant-filled-error');
        } finally {
            isModelSaving = false;
        }
    };

    const locales = enabledLocales(PUBLIC_APP_ENV);
    let isLocaleSaving = false;

    const saveLocale = async (event: Event) => {
        const locale = (event.currentTarget as HTMLSelectElement).value;
        isLocaleSaving = true;
        try {
            const response = await fetch(`/api/user/${user.id}/locale`, {
                method: 'PUT',
                body: JSON.stringify({ locale }),
            });
            if (response.ok) {
                // Every rendered string is in the old locale, so render the page again.
                window.location.reload();
                return;
            }
            const { message } = await response.json();
            makeToast(toastStore, message, 'variant-filled-error');
        } catch (err) {
            console.error({ err });
            makeToast(toastStore, m.account_language_not_saved(), 'variant-filled-error');
        }
        isLocaleSaving = false;
    };

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

        <section class="rounded-container-token border border-surface-500/40 p-5" aria-labelledby="ai-model-heading">
            <h3 id="ai-model-heading" class="h3 mb-2">AI model</h3>
            <p class="mb-4 text-sm opacity-75">
                Used by every AI feature: plan weeks, weekly reports and Explain my run.
            </p>
            {#if allowedModels.length > 1}
                <label class="label">
                    <span class="sr-only">AI model</span>
                    <select
                        class="select max-w-xs"
                        value={user.aiModel}
                        disabled={isModelSaving}
                        on:change={saveAiModel}>
                        {#each allowedModels as model}
                            <option value={model}>{model}</option>
                        {/each}
                    </select>
                </label>
            {:else}
                <p><span class="font-bold">{user.aiModel}</span> — Supporters can switch to a smarter model.</p>
            {/if}
        </section>

        {#if locales.length > 1}
            <section
                class="rounded-container-token border border-surface-500/40 p-5"
                aria-labelledby="language-heading">
                <h3 id="language-heading" class="h3 mb-2">{m.account_language_heading()}</h3>
                <p class="mb-4 text-sm opacity-75">{m.account_language_description()}</p>
                <label class="label">
                    <span class="sr-only">{m.account_language_heading()}</span>
                    <select
                        class="select max-w-xs"
                        value={user.locale}
                        disabled={isLocaleSaving}
                        on:change={saveLocale}>
                        {#each locales as locale}
                            <option value={locale}>{LOCALE_NAMES[locale]}</option>
                        {/each}
                    </select>
                </label>
            </section>
        {/if}

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
