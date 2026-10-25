<script lang="ts">
    import { m } from '$lib/paraglide/messages.js';
    import { getToastStore } from '@skeletonlabs/skeleton';
    import { makeToast } from '$lib/utils/toasts.js';
    import { billingEnabled } from '$lib/utils/billing-flag';
    import type { SubscriptionTier } from '@/constants/subscription.constants';

    export let tier: SubscriptionTier;

    const toastStore = getToastStore();
    let loading = false;

    async function startCheckout(plan: 'monthly' | 'annual') {
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
            makeToast(toastStore, json.message ?? m.billing_checkout_failed(), 'variant-filled-error');
        } catch {
            makeToast(toastStore, m.billing_checkout_failed(), 'variant-filled-error');
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
            makeToast(toastStore, json.message ?? m.billing_portal_failed(), 'variant-filled-error');
        } catch {
            makeToast(toastStore, m.billing_portal_failed(), 'variant-filled-error');
        }
        loading = false;
    }
</script>

<section class="rounded-container-token border border-surface-500/40 p-5" aria-labelledby="subscription-heading">
    <h3 id="subscription-heading" class="h3 mb-2">{m.billing_heading()}</h3>
    <p class="mb-4">
        {m.billing_current_plan()}
        <span class="font-bold text-secondary-400"
            >{tier === 'SUPPORTER' ? m.billing_tier_supporter() : m.billing_tier_free()}</span>
    </p>

    {#if tier === 'SUPPORTER'}
        <button type="button" class="btn variant-soft-primary" disabled={loading} on:click={openPortal}>
            {m.billing_manage()}
        </button>
    {:else if !billingEnabled}
        <p class="text-sm opacity-80">{m.billing_coming_soon()}</p>
    {:else}
        <p class="mb-3 text-sm opacity-80">
            {m.billing_pitch()}
        </p>
        <div class="flex flex-wrap gap-3">
            <button
                type="button"
                class="btn variant-filled-primary"
                disabled={loading}
                on:click={() => startCheckout('monthly')}>
                {m.billing_price_monthly()}
            </button>
            <button
                type="button"
                class="btn variant-soft-primary"
                disabled={loading}
                on:click={() => startCheckout('annual')}>
                {m.billing_price_annual()}
            </button>
        </div>
    {/if}
</section>
