<script lang="ts">
    import Seo from '$lib/components/seo/Seo.svelte';
    import { page } from '$app/stores';
    import { goto, invalidate } from '$app/navigation';
    import { onMount } from 'svelte';
    import { getModalStore, getToastStore } from '@skeletonlabs/skeleton';
    import { RefreshCwIcon, ArrowRightIcon } from 'svelte-feather-icons';
    import Card from '@components/card/Card.svelte';
    import ActivityRow from '$lib/components/activity-list/ActivityRow.svelte';
    import { makeToast } from '$lib/utils/toasts';
    import { validateGarminLoginFormData } from '$lib/utils/form-validation';
    import { isSyncStale } from '$lib/utils/sync-staleness';
    import { formatReportPeriod, reportSummaryPreview } from '$lib/utils/report-format';
    import { runProxySync } from '$lib/garmin/run-proxy-sync';
    import { authenticateGarmin } from '$lib/garmin/authenticate';
    import { triggerGarminLoginModal, type GarminLoginResponse } from '$lib/garmin/garmin-login-modal';
    import type { User } from '@/models/user/user.model';
    import type { DashboardPageData } from './+page.server';

    export let data: DashboardPageData;

    const user: User = $page.data.user;
    const modalStore = getModalStore();
    const toastStore = getToastStore();

    let syncing = false;
    // Garmin session token; refreshed in-place when the user re-authenticates via the modal.
    let sessionToken: string | null = data.garminSessionToken;

    const STATUS_LABEL: Record<string, string> = {
        undertraining: 'Undertraining',
        optimal: 'Optimal',
        overreach: 'Overreach',
        'high-risk': 'High risk',
    };
    const STATUS_CLASS: Record<string, string> = {
        undertraining: 'text-warning-500',
        optimal: 'text-success-500',
        overreach: 'text-warning-500',
        'high-risk': 'text-error-500',
    };

    onMount(async () => {
        modalStore.clear();
        if (data.needsInitialSync) {
            await runSync({ blocking: true, notify: true });
        } else if (isSyncStale(data.lastSyncedAt)) {
            void runSync({ blocking: false });
        }
    });

    async function runSync(opts: { blocking: boolean; notify?: boolean }) {
        if (syncing) return;
        syncing = true;
        try {
            const result = await runProxySync({
                userId: user.id,
                garminEmail: data.garminEmail,
                sessionToken,
                syncState: { backfillComplete: !data.needsInitialSync, lastSyncedAt: data.lastSyncedAt },
            });

            if (result.ok) {
                if (opts.notify) {
                    const { activitiesUpserted, mode } = result.summary;
                    makeToast(
                        toastStore,
                        activitiesUpserted > 0
                            ? `Imported ${activitiesUpserted} ${activitiesUpserted === 1 ? 'activity' : 'activities'} (${mode}).`
                            : 'Already up to date — no new activities.',
                        'variant-filled-success',
                    );
                }
                await invalidate(() => true);
                return;
            }
            if (result.code === 'INVALID_TOKEN') {
                openGarminLoginModal();
                return;
            }
            if (result.code === 'GARMIN_EMAIL_NOT_CONFIGURED') {
                makeToast(
                    toastStore,
                    'Garmin email not configured <br> Please set up Garmin integration in your account settings',
                    'variant-filled-warning',
                );
                return;
            }
            if (result.code === 'STALE_STATE') {
                await invalidate(() => true);
                return;
            }
            makeToast(toastStore, result.message || 'Sync failed', 'variant-filled-error');
        } finally {
            syncing = false;
        }
    }

    function openGarminLoginModal() {
        triggerGarminLoginModal(modalStore, {
            body: 'Provide credentials to connect to your Garmin Connect account and refresh activities.',
            response: handleGarminLoginResponse,
        });
    }

    async function handleGarminLoginResponse(loginFormData: GarminLoginResponse) {
        if (!loginFormData) return;
        if (validateGarminLoginFormData(loginFormData)) {
            makeToast(toastStore, 'Invalid form data', 'variant-filled-error');
            return;
        }
        // Exchange the password for a session token, then retry the sync with it.
        syncing = true;
        const auth = await authenticateGarmin(user.id, loginFormData.password);
        syncing = false;
        if (!auth.ok) {
            makeToast(toastStore, auth.message || 'Garmin login failed', 'variant-filled-error');
            return;
        }
        sessionToken = auth.sessionToken;
        await runSync({ blocking: true, notify: true });
    }

    function formatRelative(iso: string | null): string {
        if (!iso) return 'never';
        const diffMin = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
        if (diffMin < 1) return 'just now';
        if (diffMin < 60) return `${diffMin} min ago`;
        const diffHr = Math.round(diffMin / 60);
        if (diffHr < 24) return `${diffHr}h ago`;
        return `${Math.round(diffHr / 24)}d ago`;
    }

    function formatKm(meters: number): string {
        return `${(meters / 1000).toFixed(1)} km`;
    }

    $: summary = data.summary;
</script>

<Seo title="Analytics | GymCraft™" metaDescription="Training analytics dashboard." />

<Card width="3/4">
    <div class="md:w-5/6 m-auto pb-8 pt-4">
        <div class="flex flex-wrap items-center justify-between gap-3 mb-6">
            <h2 class="h2 text-xl font-bold m-0">Analytics</h2>
            <div class="flex items-center gap-3 text-sm">
                <span class="opacity-70">Synced {formatRelative(data.lastSyncedAt)}</span>
                <button
                    type="button"
                    class="btn btn-sm variant-soft-primary"
                    disabled={syncing}
                    on:click={() => runSync({ blocking: false, notify: true })}>
                    <RefreshCwIcon size="14" class={syncing ? 'animate-spin' : ''} />
                    <span>{syncing ? 'Syncing…' : 'Sync now'}</span>
                </button>
            </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-10">
            <div class="card variant-soft-surface p-4 flex flex-col gap-1">
                <span class="text-xs uppercase opacity-60">Load</span>
                {#if summary.hasActivities && summary.acwr > 0}
                    <span class="text-lg font-bold {STATUS_CLASS[summary.loadStatus]}">
                        {STATUS_LABEL[summary.loadStatus]}
                    </span>
                    <span class="text-xs opacity-70">ACWR {summary.acwr.toFixed(2)}</span>
                {:else}
                    <span class="text-lg font-bold opacity-50">—</span>
                    <span class="text-xs opacity-70">Not enough history</span>
                {/if}
            </div>
            <div class="card variant-soft-surface p-4 flex flex-col gap-1">
                <span class="text-xs uppercase opacity-60">7-day distance</span>
                <span class="text-lg font-bold"
                    >{summary.hasActivities ? formatKm(summary.sevenDayDistanceM) : '—'}</span>
                <span class="text-xs opacity-70">last 7 days</span>
            </div>
            <div class="card variant-soft-surface p-4 flex flex-col gap-1">
                <span class="text-xs uppercase opacity-60">Monotony</span>
                {#if summary.hasActivities}
                    <span class="text-lg font-bold">{summary.monotony.toFixed(2)}</span>
                    <span class="text-xs {summary.monotonyIsHigh ? 'text-warning-500' : 'opacity-70'}">
                        {summary.monotonyIsHigh ? 'high' : 'good'}
                    </span>
                {:else}
                    <span class="text-lg font-bold opacity-50">—</span>
                    <span class="text-xs opacity-70">last 7 days</span>
                {/if}
            </div>
            <div class="card variant-soft-surface p-4 flex flex-col gap-1">
                <span class="text-xs uppercase opacity-60">Sessions</span>
                <span class="text-lg font-bold">{summary.hasActivities ? summary.sessions7d : '—'}</span>
                <span class="text-xs opacity-70">/ 7 days</span>
            </div>
        </div>

        <section class="mb-10">
            <div class="flex flex-wrap items-center justify-between gap-2 mb-3">
                <h3 class="h3 text-lg font-semibold m-0">Recent activities</h3>
                <a href="/app/running/analytics/activities" class="anchor text-sm flex items-center gap-1">
                    See all <ArrowRightIcon size="14" />
                </a>
            </div>
            {#if data.recentActivities.length}
                <ul class="list border rounded-2xl border-surface-900 dark:border-surface-500">
                    {#each data.recentActivities as activity (activity.id)}
                        <ActivityRow {activity} />
                    {/each}
                </ul>
            {:else if syncing}
                <p class="text-center opacity-70 py-6">Fetching your Garmin history…</p>
            {:else}
                <p class="text-center opacity-70 italic py-6">
                    No activities yet — use “Sync now” above to import your Garmin history.
                </p>
            {/if}
        </section>

        <section class="mb-10">
            <div class="flex flex-wrap items-center justify-between gap-2 mb-3">
                <h3 class="h3 text-lg font-semibold m-0">Recent reports</h3>
                <a href="/app/running/analytics/reports" class="anchor text-sm flex items-center gap-1">
                    See all <ArrowRightIcon size="14" />
                </a>
            </div>
            {#if data.recentReports.length}
                <ul class="space-y-3">
                    {#each data.recentReports as report (report.id)}
                        <li>
                            <a
                                href="/app/running/analytics/reports/{report.id}"
                                data-sveltekit-preload-data="hover"
                                class="block rounded-xl border border-surface-300 dark:border-surface-700 p-4 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors no-underline text-inherit">
                                <div class="flex flex-wrap justify-between items-baseline gap-2">
                                    <h4 class="font-semibold">
                                        Week of {formatReportPeriod(report.periodStart, report.periodEnd)}
                                    </h4>
                                    <span class="text-xs opacity-60">
                                        {new Date(report.createdAt).toLocaleDateString()}
                                    </span>
                                </div>
                                <p class="text-sm opacity-80 mt-1">{reportSummaryPreview(report.summary)}</p>
                            </a>
                        </li>
                    {/each}
                </ul>
            {:else}
                <p class="text-center opacity-70 italic py-4">No reports yet — generate your first weekly report.</p>
            {/if}
            <div class="flex justify-center mt-4">
                <button
                    type="button"
                    class="btn variant-filled-primary"
                    on:click={() => goto('/app/running/analytics/reports')}>
                    Generate new report
                </button>
            </div>
        </section>
    </div>

    <div class="md:w-3/4 m-auto pb-8">
        <p class="h3 font-bold mb-4 text-primary-700 dark:text-error-500 text-center">Do you like this app?</p>
        <div class="text-center">
            <iframe
                title="Buy Me a Coffee"
                src="/bmc-widget.html"
                width="250"
                height="80"
                scrolling="no"
                style="border: none; margin: auto; display: block;"
                loading="lazy"></iframe>
        </div>
    </div>
</Card>
