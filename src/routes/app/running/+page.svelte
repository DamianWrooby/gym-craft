<script lang="ts">
    import { m } from '$lib/paraglide/messages.js';
    import { BarChart2Icon, ArrowRightIcon, RefreshCwIcon, CheckCircleIcon } from 'svelte-feather-icons';
    import { page } from '$app/stores';
    import { invalidateAll } from '$app/navigation';
    import { getModalStore } from '@skeletonlabs/skeleton';
    import Card from '@components/card/Card.svelte';
    import SportIcon from '@components/sport-icon/SportIcon.svelte';
    import Seo from '$lib/components/seo/Seo.svelte';
    import { runProxySync } from '$lib/garmin/run-proxy-sync';
    import { TIER_LIMITS, type SubscriptionTier } from '@/constants/subscription.constants';
    import { withGarminLogin } from '$lib/garmin/garmin-login';
    import { askGarminCredentials } from '$lib/garmin/garmin-login-modal';
    import { formatRelativeTime } from '$lib/utils/relative-time';

    export let data: {
        garminConnected: boolean;
        garminEmail: string | null;
        garminSessionToken: string | null;
        syncState: { backfillComplete: boolean; lastSyncedAt: string | null; oldestActivityAt: string | null } | null;
    };

    const modalStore = getModalStore();

    let syncing = false;
    let syncError: string | null = null;
    let syncMessage: string | null = null;
    /** Only set while a multi-window backfill is running — a single-call sync has nothing to count. */
    let syncProgress: string | null = null;
    // The Garmin session and email; replaced in place when the user signs in again via the modal.
    let sessionToken: string | null = data.garminSessionToken;
    let garminEmail: string | null = data.garminEmail;

    $: backfillDays = TIER_LIMITS[($page.data.user?.subscriptionTier as SubscriptionTier) ?? 'FREE'].garminBackfillDays;
    $: backfillNeeded = data.garminConnected && (!data.syncState || !data.syncState.backfillComplete);
    $: lastSyncedLabel = data.syncState?.lastSyncedAt ? formatRelativeTime(data.syncState.lastSyncedAt) : null;

    async function runSync(retriedOnStale = false) {
        syncing = true;
        syncError = null;
        syncMessage = null;
        syncProgress = null;
        try {
            const userId = $page.data.user?.id ?? '';
            const result = await withGarminLogin(
                userId,
                (login) => {
                    if (login) ({ sessionToken, email: garminEmail } = login);
                    return runProxySync({
                        userId: userId,
                        garminEmail,
                        sessionToken,
                        syncState: data.syncState,
                        backfillDays: backfillDays,
                        onProgress: (completed, total) => {
                            syncProgress = total > 1 ? m.running_sync_progress({ completed, total }) : null;
                        },
                    });
                },
                () =>
                    askGarminCredentials(modalStore, {
                        body: m.running_garmin_login_body(),
                    }),
            );

            if (result.ok) {
                syncMessage = m.running_sync_done({ count: result.summary.activitiesUpserted });
                await invalidateAll();
                return;
            }

            if (result.code === 'RATE_LIMITED') {
                // Credentials are fine and Garmin is busy. A login prompt here would send the
                // athlete through a cold password login, the most throttled path of all.
                syncError = m.running_sync_rate_limited();
                return;
            }

            if (result.code === 'LOGIN_CANCELLED') return;

            if (result.code === 'STALE_STATE' && !retriedOnStale) {
                // Sync state changed since the page loaded — refresh state and retry once with it.
                await invalidateAll();
                await runSync(true);
                return;
            }

            if (result.code === 'GARMIN_TIMEOUT') {
                // Garmin itself was too slow, not a credentials or data problem — a plain retry
                // often succeeds, and each retry picks up where the last sync left off.
                syncError = m.running_sync_timeout();
                return;
            }

            syncError = result.message;
        } catch (err) {
            syncError = err instanceof Error ? err.message : m.running_sync_failed();
        } finally {
            syncing = false;
            syncProgress = null;
        }
    }
</script>

<Seo title="Running | GymCraft™" metaDescription="Running hub — review your activity analytics from Garmin Connect." />

<Card width="3/4">
    <div class="flex flex-col items-center text-center gap-3 pb-8">
        <span class="text-tertiary-500">
            <SportIcon sport="running" size={48} />
        </span>
        <h2 class="h2 text-2xl md:text-3xl">{m.nav_running()}</h2>
        <p class="text-surface-500 dark:text-surface-300 max-w-xl">
            {m.running_intro()}
        </p>
    </div>

    {#if data.garminConnected}
        <div class="md:w-3/4 m-auto pb-6">
            {#if backfillNeeded}
                <aside class="card variant-soft-warning p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                    <div class="flex-1">
                        <p class="font-semibold">{m.running_import_heading()}</p>
                        <p class="text-sm opacity-80">
                            {m.running_import_body({ days: backfillDays })}
                        </p>
                    </div>
                    <button class="btn variant-filled-warning" on:click={() => runSync()} disabled={syncing}>
                        <RefreshCwIcon size="16" class={syncing ? 'animate-spin' : ''} />
                        <span>{syncing ? m.running_importing() : m.running_import_now()}</span>
                    </button>
                </aside>
            {:else if data.syncState}
                <aside class="card variant-soft-surface p-3 flex items-center gap-3 text-sm">
                    <CheckCircleIcon size="18" class="text-success-500" />
                    <span class="flex-1">
                        {lastSyncedLabel ? m.running_synced_ago({ ago: lastSyncedLabel }) : m.running_synced()}
                    </span>
                    <button class="btn btn-sm variant-ghost-surface" on:click={() => runSync()} disabled={syncing}>
                        <RefreshCwIcon size="14" class={syncing ? 'animate-spin' : ''} />
                        <span>{syncing ? m.running_syncing() : m.running_refresh()}</span>
                    </button>
                </aside>
            {/if}
            {#if syncProgress}
                <p class="text-sm opacity-80 mt-2">{syncProgress}</p>
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
            <h3 class="h3 text-lg font-semibold">{m.running_analytics()}</h3>
            <p class="text-sm text-surface-500 dark:text-surface-300">
                {m.running_analytics_description()}
            </p>
        </a>
    </div>
</Card>
