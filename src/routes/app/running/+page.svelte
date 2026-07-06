<script lang="ts">
    import { BarChart2Icon, ArrowRightIcon, RefreshCwIcon, CheckCircleIcon } from 'svelte-feather-icons';
    import { page } from '$app/stores';
    import { invalidateAll } from '$app/navigation';
    import { getModalStore, getToastStore } from '@skeletonlabs/skeleton';
    import Card from '@components/card/Card.svelte';
    import SportIcon from '@components/sport-icon/SportIcon.svelte';
    import Seo from '$lib/components/seo/Seo.svelte';
    import { makeToast } from '$lib/utils/toasts';
    import { validateGarminLoginFormData } from '$lib/utils/form-validation';
    import { runProxySync } from '$lib/garmin/run-proxy-sync';
    import { TIER_LIMITS, type SubscriptionTier } from '@/constants/subscription.constants';
    import { authenticateGarmin } from '$lib/garmin/authenticate';
    import { triggerGarminLoginModal, type GarminLoginResponse } from '$lib/garmin/garmin-login-modal';

    export let data: {
        garminConnected: boolean;
        garminEmail: string | null;
        garminSessionToken: string | null;
        syncState: { backfillComplete: boolean; lastSyncedAt: string | null; oldestActivityAt: string | null } | null;
    };

    const modalStore = getModalStore();
    const toastStore = getToastStore();

    let syncing = false;
    let syncError: string | null = null;
    let syncMessage: string | null = null;
    // The Garmin session token; refreshed in-place when the user re-authenticates via the modal.
    let sessionToken: string | null = data.garminSessionToken;

    $: backfillDays = TIER_LIMITS[($page.data.user?.subscriptionTier as SubscriptionTier) ?? 'FREE'].garminBackfillDays;
    $: backfillNeeded = data.garminConnected && (!data.syncState || !data.syncState.backfillComplete);
    $: lastSyncedLabel = data.syncState?.lastSyncedAt ? formatRelative(data.syncState.lastSyncedAt) : null;

    function formatRelative(iso: string): string {
        const then = new Date(iso).getTime();
        const diffMin = Math.round((Date.now() - then) / 60000);
        if (diffMin < 1) return 'just now';
        if (diffMin < 60) return `${diffMin} min ago`;
        const diffHr = Math.round(diffMin / 60);
        if (diffHr < 24) return `${diffHr}h ago`;
        const diffDay = Math.round(diffHr / 24);
        return `${diffDay}d ago`;
    }

    async function runSync(retriedOnStale = false) {
        syncing = true;
        syncError = null;
        syncMessage = null;
        try {
            const result = await runProxySync({
                userId: $page.data.user?.id ?? '',
                garminEmail: data.garminEmail,
                sessionToken,
                syncState: data.syncState,
                backfillDays,
            });

            if (result.ok) {
                syncMessage = `Imported ${result.summary.activitiesUpserted} activities (${result.summary.mode}).`;
                await invalidateAll();
                return;
            }

            if (result.code === 'INVALID_TOKEN') {
                makeToast(
                    toastStore,
                    'Invalid token <br> Please log in to your Garmin account',
                    'variant-filled-warning',
                );
                openGarminLoginModal();
                return;
            }

            if (result.code === 'STALE_STATE' && !retriedOnStale) {
                // Sync state changed since the page loaded — refresh state and retry once with it.
                await invalidateAll();
                await runSync(true);
                return;
            }

            syncError = result.message;
        } catch (err) {
            syncError = err instanceof Error ? err.message : 'Sync failed';
        } finally {
            syncing = false;
        }
    }

    function openGarminLoginModal() {
        triggerGarminLoginModal(modalStore, {
            body: 'Provide credentials to connect to your Garmin Connect account and sync your activities.',
            response: handleGarminLogin,
        });
    }

    async function handleGarminLogin(loginFormData: GarminLoginResponse) {
        if (!loginFormData) return;

        const formValidationError = validateGarminLoginFormData(loginFormData);
        if (formValidationError) {
            makeToast(toastStore, 'Form validation error', 'variant-filled-error');
            return;
        }

        // Exchange the password for a session token, then retry the sync with it.
        syncing = true;
        const auth = await authenticateGarmin($page.data.user?.id ?? '', loginFormData.password);
        syncing = false;
        if (!auth.ok) {
            makeToast(toastStore, auth.message || 'Garmin login failed', 'variant-filled-error');
            return;
        }
        sessionToken = auth.sessionToken;
        await runSync();
    }
</script>

<Seo title="Running | GymCraft™" metaDescription="Running hub — review your activity analytics from Garmin Connect." />

<Card width="3/4">
    <div class="flex flex-col items-center text-center gap-3 pb-8">
        <span class="text-tertiary-500">
            <SportIcon sport="running" size={48} />
        </span>
        <h2 class="h2 text-2xl md:text-3xl">Running</h2>
        <p class="text-surface-500 dark:text-surface-300 max-w-xl">
            Review your training activity synced from Garmin Connect. More running tools are coming soon.
        </p>
    </div>

    {#if data.garminConnected}
        <div class="md:w-3/4 m-auto pb-6">
            {#if backfillNeeded}
                <aside class="card variant-soft-warning p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                    <div class="flex-1">
                        <p class="font-semibold">Import your Garmin history</p>
                        <p class="text-sm opacity-80">
                            We'll fetch your last {backfillDays} days of activities so training-load analytics can work. This
                            runs once and takes a few seconds.
                        </p>
                    </div>
                    <button class="btn variant-filled-warning" on:click={() => runSync()} disabled={syncing}>
                        <RefreshCwIcon size="16" class={syncing ? 'animate-spin' : ''} />
                        <span>{syncing ? 'Importing…' : 'Import now'}</span>
                    </button>
                </aside>
            {:else if data.syncState}
                <aside class="card variant-soft-surface p-3 flex items-center gap-3 text-sm">
                    <CheckCircleIcon size="18" class="text-success-500" />
                    <span class="flex-1">
                        Synced{lastSyncedLabel ? ` ${lastSyncedLabel}` : ''}. Training history ready.
                    </span>
                    <button class="btn btn-sm variant-ghost-surface" on:click={() => runSync()} disabled={syncing}>
                        <RefreshCwIcon size="14" class={syncing ? 'animate-spin' : ''} />
                        <span>{syncing ? 'Syncing…' : 'Refresh'}</span>
                    </button>
                </aside>
            {/if}
            {#if syncError}
                <p class="text-error-500 text-sm mt-2">{syncError}</p>
            {/if}
            {#if syncMessage}
                <p class="text-success-500 text-sm mt-2">{syncMessage}</p>
            {/if}
        </div>
    {/if}

    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 md:w-3/4 m-auto pb-4">
        <a
            href="/app/running/analytics"
            data-sveltekit-preload-data="hover"
            class="group card variant-soft-surface hover:variant-soft-tertiary transition-colors p-6 flex flex-col gap-3 no-underline">
            <div class="flex items-center justify-between">
                <span class="text-tertiary-500 group-hover:text-tertiary-400">
                    <BarChart2Icon size="28" />
                </span>
                <ArrowRightIcon size="20" class="opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <h3 class="h3 text-lg font-semibold">Analytics</h3>
            <p class="text-sm text-surface-500 dark:text-surface-300">
                Browse your Garmin activities — pace, distance, and trends over time.
            </p>
        </a>
    </div>
</Card>
