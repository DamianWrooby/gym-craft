<script lang="ts">
    import Seo from '$lib/components/seo/Seo.svelte';
    import { page } from '$app/stores';
    import { goto, invalidateAll } from '$app/navigation';
    import { onMount } from 'svelte';
    import { getModalStore, getToastStore } from '@skeletonlabs/skeleton';
    import { RefreshCwIcon, ArrowRightIcon } from 'svelte-feather-icons';
    import Card from '@components/card/Card.svelte';
    import ActivityRow from '$lib/components/activity-list/ActivityRow.svelte';
    import SkeletonBlock from '$lib/components/loading/skeleton-block/SkeletonBlock.svelte';
    import { makeToast } from '$lib/utils/toasts';
    import { validateGarminLoginFormData } from '$lib/utils/form-validation';
    import { isSyncStale } from '$lib/utils/sync-staleness';
    import { formatReportPeriod, reportSummaryPreview } from '$lib/utils/report-format';
    import { runProxySync } from '$lib/garmin/run-proxy-sync';
    import { TIER_LIMITS } from '@/constants/subscription.constants';
    import { authenticateGarmin } from '$lib/garmin/authenticate';
    import { triggerGarminLoginModal, type GarminLoginResponse } from '$lib/garmin/garmin-login-modal';
    import type { User } from '@/models/user/user.model';
    import type { ActivityModality } from '$lib/utils/activity-type';
    import type { ModalityDistance } from '$lib/server/analytics/load/dashboard-summary';
    import type { DashboardPageData } from './+page.server';

    export let data: DashboardPageData;

    const user: User = $page.data.user;
    const modalStore = getModalStore();
    const toastStore = getToastStore();

    let syncing = false;
    /** Only set while a multi-window backfill is running — a single-call sync has nothing to count. */
    let syncProgress: string | null = null;
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
                backfillDays: TIER_LIMITS[user.subscriptionTier].garminBackfillDays,
                onProgress: (completed, total) => {
                    syncProgress = total > 1 ? `${completed} of ${total} periods imported…` : null;
                },
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
                // invalidate(() => true) only reruns loads with url dependencies; this page's
                // server load has none, so it needs invalidateAll to refetch after sync.
                await invalidateAll();
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
                await invalidateAll();
                return;
            }
            if (result.code === 'GARMIN_TIMEOUT') {
                // Garmin was too slow — transient, and a retry resumes from the last sync point.
                makeToast(
                    toastStore,
                    'Garmin took too long to respond <br> Please try syncing again',
                    'variant-filled-warning',
                );
                return;
            }
            makeToast(toastStore, result.message || 'Sync failed', 'variant-filled-error');
        } finally {
            syncing = false;
            syncProgress = null;
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

    const MODALITY_LABEL: Record<ActivityModality, string> = {
        running: 'Running',
        cycling: 'Cycling',
        swimming: 'Swimming',
        other: 'Other',
    };

    /**
     * Running always renders, even at zero — it is what this dashboard is for. The rest render
     * only once the athlete has covered ground in them over the 28-day window, so a runner who
     * lifts never sees a permanent `Other · 0.0 km`, while a triathlete keeps a stable row
     * through a run-only week and can tell zero apart from absent.
     */
    function visibleDistances(distances: ModalityDistance[]): ModalityDistance[] {
        return distances.filter((d) => d.modality === 'running' || d.chronicDistanceM > 0);
    }
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

        {#await data.summary}
            <h3 class="text-xs uppercase tracking-wide opacity-60 mb-2">Training load · all activities</h3>
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4 mb-6">
                {#each ['Load', 'Monotony', 'Sessions'] as label (label)}
                    <div class="card variant-soft-surface p-4 flex flex-col gap-2">
                        <span class="text-xs uppercase opacity-60">{label}</span>
                        <SkeletonBlock height="h-6" width="w-2/3" />
                        <SkeletonBlock height="h-3" width="w-1/2" />
                    </div>
                {/each}
            </div>
            <h3 class="text-xs uppercase tracking-wide opacity-60 mb-2">7-day distance by sport</h3>
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-10">
                <div class="card variant-soft-surface p-4 flex flex-col gap-2">
                    <span class="text-xs uppercase opacity-60">Running</span>
                    <SkeletonBlock height="h-6" width="w-2/3" />
                    <SkeletonBlock height="h-3" width="w-1/2" />
                </div>
            </div>
        {:then summary}
            <!-- Load, monotony and sessions span every training modality; only distance is split
                 per sport. The two headings state that, so no tile has to be read as a claim
                 about running alone. -->
            <h3 class="text-xs uppercase tracking-wide opacity-60 mb-2">Training load · all activities</h3>
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4 mb-6">
                <div class="card variant-soft-surface p-4 flex flex-col gap-1">
                    <span class="text-xs uppercase opacity-60">Load</span>
                    {#if summary.hasActivities && summary.hasSufficientHistory && summary.acwr > 0}
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

            <h3 class="text-xs uppercase tracking-wide opacity-60 mb-2">7-day distance by sport</h3>
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-10">
                {#each visibleDistances(summary.distanceByModality) as entry (entry.modality)}
                    <div class="card variant-soft-surface p-4 flex flex-col gap-1">
                        <span class="text-xs uppercase opacity-60">{MODALITY_LABEL[entry.modality]}</span>
                        <span class="text-lg font-bold"
                            >{summary.hasActivities ? formatKm(entry.sevenDayDistanceM) : '—'}</span>
                        <span class="text-xs opacity-70">
                            {entry.modality === 'other' ? 'mixed sports · last 7 days' : 'last 7 days'}
                        </span>
                    </div>
                {/each}
            </div>
        {:catch}
            <!-- Never fall back to a zeroed summary: interpretAcwr(0) reads as
                 'Undertraining', which would state something false about the athlete. -->
            <div class="card variant-soft-warning p-4 mb-10 flex flex-wrap items-center justify-between gap-3">
                <span class="text-sm">Training load unavailable right now.</span>
                <button type="button" class="btn btn-sm variant-soft" on:click={() => invalidateAll()}>Retry</button>
            </div>
        {/await}

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
                <p class="text-center opacity-70 py-6">
                    {syncProgress ?? 'Fetching your Garmin history…'}
                </p>
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
            {#await data.recentReports}
                <ul class="space-y-3">
                    {#each [0, 1, 2] as i (i)}
                        <li
                            class="rounded-xl border border-surface-300 dark:border-surface-700 p-4 flex flex-col gap-2">
                            <SkeletonBlock height="h-4" width="w-1/2" />
                            <SkeletonBlock height="h-3" width="w-full" />
                        </li>
                    {/each}
                </ul>
            {:then recentReports}
                {#if recentReports.length}
                    <ul class="space-y-3">
                        {#each recentReports as report (report.id)}
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
                    <p class="text-center opacity-70 italic py-4">
                        No reports yet — generate your first weekly report.
                    </p>
                {/if}
            {:catch}
                <p class="text-center opacity-70 italic py-4">Recent reports unavailable right now.</p>
            {/await}
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
