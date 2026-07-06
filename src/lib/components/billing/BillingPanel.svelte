<script lang="ts">
    import { getToastStore } from '@skeletonlabs/skeleton';
    import { makeToast } from '$lib/utils/toasts.js';
    import type { SubscriptionTier } from '@/constants/subscription.constants';

    export let tier: SubscriptionTier;

    const toastStore = getToastStore();
    let loading = false;

    async function startCheckout(plan: 'monthly' | 'annual' | 'lifetime') {
        loading = true;
        try {
            const res = await fetch('/api/stripe/checkout', {
                method: 'POST',
                body: JSON.stringify({ plan }),
            });
            const json = await res.json();
            if (res.ok && json.url) {
                window.location.href = json.url;
                return;
            }
            makeToast(toastStore, json.message ?? 'Could not start checkout', 'variant-filled-error');
        } catch {
            makeToast(toastStore, 'Could not start checkout', 'variant-filled-error');
        }
        loading = false;
    }

    async function openPortal() {
        loading = true;
        try {
            const res = await fetch('/api/stripe/portal', { method: 'POST' });
            const json = await res.json();
            if (res.ok && json.url) {
                window.location.href = json.url;
                return;
            }
            makeToast(toastStore, json.message ?? 'Could not open billing portal', 'variant-filled-error');
        } catch {
            makeToast(toastStore, 'Could not open billing portal', 'variant-filled-error');
        }
        loading = false;
    }
</script>

<div class="mt-8 border rounded border-solid border-surface-500 p-5">
    <h3 class="h3 mb-2">Subscription</h3>
    <p class="mb-4">
        Current plan:
        <span class="font-bold text-secondary-400">{tier === 'SUPPORTER' ? 'Supporter' : 'Free'}</span>
    </p>

    {#if tier === 'SUPPORTER'}
        <button type="button" class="btn variant-soft-primary" disabled={loading} on:click={openPortal}>
            Manage subscription
        </button>
    {:else}
        <p class="mb-3 text-sm opacity-80">
            Support GymCraft and unlock the full toolkit: 15 weekly reports &amp; 5 AI gym plans per month, 5 run
            explanations per day, a smarter AI coach model, 120-day Garmin import, report export, and a Supporter badge.
        </p>
        <div class="flex flex-wrap gap-3">
            <button
                type="button"
                class="btn variant-filled-primary"
                disabled={loading}
                on:click={() => startCheckout('monthly')}>
                €4 / month
            </button>
            <button
                type="button"
                class="btn variant-soft-primary"
                disabled={loading}
                on:click={() => startCheckout('annual')}>
                €36 / year
            </button>
            <button
                type="button"
                class="btn variant-soft-secondary"
                disabled={loading}
                on:click={() => startCheckout('lifetime')}>
                €25 lifetime
            </button>
        </div>
    {/if}
</div>
