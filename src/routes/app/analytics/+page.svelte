<script lang="ts">
    import { m } from '$lib/paraglide/messages.js';
    import { formatRelativeTime } from '$lib/utils/relative-time';
    import { statusLabel } from '$lib/utils/load-status';
    import { getLocale } from '$lib/paraglide/runtime.js';
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
    import { isSyncStale } from '$lib/utils/sync-staleness';
    import { formatReportPeriod } from '$lib/utils/report-format';
    import { runProxySync } from '$lib/garmin/run-proxy-sync';
    import { TIER_LIMITS } from '@/constants/subscription.constants';
    import { withGarminLogin } from '$lib/garmin/garmin-login';
    import { askGarminCredentials, askGarminMfaCode } from '$lib/garmin/garmin-login-modal';
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
    // Garmin session and email; replaced in place when the user signs in again via the modal.
    let sessionToken: string | null = data.garminSessionToken;
    let garminEmail: string | null = data.garminEmail;

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
            const result = await withGarminLogin(
                user.id,
                (login) => {
                    if (login) ({ sessionToken, email: garminEmail } = login);
                    return runProxySync({
                        userId: user.id,
                        garminEmail,
                        sessionToken,
                        syncState: { backfillComplete: !data.needsInitialSync, lastSyncedAt: data.lastSyncedAt },
                        backfillDays: TIER_LIMITS[user.subscriptionTier].garminBackfillDays,
                        onProgress: (completed, total) => {
                            syncProgress = total > 1 ? m.running_sync_progress({ completed, total }) : null;
                        },
                    });
                },
                () =>
                    askGarminCredentials(modalStore, {
                        body: m.analytics_garmin_login_body(),
                    }),
                (retry) => askGarminMfaCode(modalStore, retry),
            );

            if (result.ok) {
                if (opts.notify) {
                    const { activitiesUpserted } = result.summary;
                    makeToast(
                        toastStore,
                        activitiesUpserted > 0
                            ? m.running_sync_done({ count: activitiesUpserted })
                            : m.analytics_up_to_date(),
                        'variant-filled-success',
                    );
                }
                // invalidate(() => true) only reruns loads with url dependencies; this page's
                // server load has none, so it needs invalidateAll to refetch after sync.
                await invalidateAll();
                return;
            }
            if (result.code === 'RATE_LIMITED') {
                // Credentials are fine and Garmin is busy. A login prompt here would send the
                // athlete through a cold password login, the most throttled path of all.
                makeToast(toastStore, m.running_sync_rate_limited(), 'variant-filled-warning');
                return;
            }
            if (result.code === 'LOGIN_CANCELLED') return;
            if (result.code === 'STALE_STATE') {
                await invalidateAll();
                return;
            }
            if (result.code === 'GARMIN_TIMEOUT') {
                // Garmin was too slow — transient, and a retry resumes from the last sync point.
                makeToast(toastStore, m.running_sync_timeout(), 'variant-filled-warning');
                return;
            }
            makeToast(toastStore, result.message || m.running_sync_failed(), 'variant-filled-error');
        } finally {
            syncing = false;
            syncProgress = null;
        }
    }

    function formatKm(meters: number): string {
        return `${(meters / 1000).toFixed(1)} km`;
    }

    const MODALITY_LABEL: Record<ActivityModality, () => string> = {
        running: m.analytics_modality_running,
        cycling: m.analytics_modality_cycling,
        swimming: m.analytics_modality_swimming,
        other: m.analytics_modality_other,
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

<Seo title={`${m.running_analytics()} | GymCraft™`} metaDescription="Training analytics dashboard." />

<Card width="3/4">
    <div class="md:w-5/6 m-auto pb-8 pt-4">
        <div class="flex flex-wrap items-center justify-between gap-3 mb-6">
            <h2 class="h2 text-xl font-bold m-0">{m.running_analytics()}</h2>
            <div class="flex items-center gap-3 text-sm">
                <span class="opacity-70"
                    >{data.lastSyncedAt
                        ? m.analytics_synced_ago({ ago: formatRelativeTime(data.lastSyncedAt) })
                        : m.analytics_never_synced()}</span>
                <button
                    type="button"
                    class="btn btn-sm variant-soft-primary"
                    disabled={syncing}
                    on:click={() => runSync({ blocking: false, notify: true })}>
                    <RefreshCwIcon size="14" class={syncing ? 'animate-spin' : ''} />
                    <span>{syncing ? m.running_syncing() : m.analytics_sync_now()}</span>
                </button>
            </div>
        </div>

        {#await data.summary}
            <h3 class="text-xs uppercase tracking-wide opacity-60 mb-2">{m.analytics_load_heading()}</h3>
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4 mb-6">
                {#each [m.analytics_load(), m.analytics_monotony(), m.analytics_sessions()] as label (label)}
                    <div class="card variant-soft-surface p-4 flex flex-col gap-2">
                        <span class="text-xs uppercase opacity-60">{label}</span>
                        <SkeletonBlock height="h-6" width="w-2/3" />
                        <SkeletonBlock height="h-3" width="w-1/2" />
                    </div>
                {/each}
            </div>
            <h3 class="text-xs uppercase tracking-wide opacity-60 mb-2">{m.analytics_distance_heading()}</h3>
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-10">
                <div class="card variant-soft-surface p-4 flex flex-col gap-2">
                    <span class="text-xs uppercase opacity-60">{m.analytics_modality_running()}</span>
                    <SkeletonBlock height="h-6" width="w-2/3" />
                    <SkeletonBlock height="h-3" width="w-1/2" />
                </div>
            </div>
        {:then summary}
            <!-- Load, monotony and sessions span every training modality; only distance is split
                 per sport. The two headings state that, so no tile has to be read as a claim
                 about running alone. -->
            <h3 class="text-xs uppercase tracking-wide opacity-60 mb-2">{m.analytics_load_heading()}</h3>
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4 mb-6">
                <div class="card variant-soft-surface p-4 flex flex-col gap-1">
                    <span class="text-xs uppercase opacity-60">{m.analytics_load()}</span>
                    {#if summary.hasActivities && summary.hasSufficientHistory && summary.acwr > 0}
                        <span class="text-lg font-bold {STATUS_CLASS[summary.loadStatus]}">
                            {statusLabel(summary.loadStatus)}
                        </span>
                        <span class="text-xs opacity-70">ACWR {summary.acwr.toFixed(2)}</span>
                    {:else}
                        <span class="text-lg font-bold opacity-50">—</span>
                        <span class="text-xs opacity-70">{m.analytics_not_enough_history()}</span>
                    {/if}
                </div>
                <div class="card variant-soft-surface p-4 flex flex-col gap-1">
                    <span class="text-xs uppercase opacity-60">{m.analytics_monotony()}</span>
                    {#if summary.hasActivities}
                        <span class="text-lg font-bold">{summary.monotony.toFixed(2)}</span>
                        <span class="text-xs {summary.monotonyIsHigh ? 'text-warning-500' : 'opacity-70'}">
                            {summary.monotonyIsHigh ? m.analytics_monotony_high() : m.analytics_monotony_good()}
                        </span>
                    {:else}
                        <span class="text-lg font-bold opacity-50">—</span>
                        <span class="text-xs opacity-70">{m.analytics_last_7_days()}</span>
                    {/if}
                </div>
                <div class="card variant-soft-surface p-4 flex flex-col gap-1">
                    <span class="text-xs uppercase opacity-60">{m.analytics_sessions()}</span>
                    <span class="text-lg font-bold">{summary.hasActivities ? summary.sessions7d : '—'}</span>
                    <span class="text-xs opacity-70">{m.analytics_per_7_days()}</span>
                </div>
            </div>

            <h3 class="text-xs uppercase tracking-wide opacity-60 mb-2">{m.analytics_distance_heading()}</h3>
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-10">
                {#each visibleDistances(summary.distanceByModality) as entry (entry.modality)}
                    <div class="card variant-soft-surface p-4 flex flex-col gap-1">
                        <span class="text-xs uppercase opacity-60">{MODALITY_LABEL[entry.modality]()}</span>
                        <span class="text-lg font-bold"
                            >{summary.hasActivities ? formatKm(entry.sevenDayDistanceM) : '—'}</span>
                        <span class="text-xs opacity-70">
                            {entry.modality === 'other' ? m.analytics_mixed_last_7_days() : m.analytics_last_7_days()}
                        </span>
                    </div>
                {/each}
            </div>
        {:catch}
            <!-- Never fall back to a zeroed summary: interpretAcwr(0) reads as
                 'Undertraining', which would state something false about the athlete. -->
            <div class="card variant-soft-warning p-4 mb-10 flex flex-wrap items-center justify-between gap-3">
                <span class="text-sm">{m.analytics_load_unavailable()}</span>
                <button type="button" class="btn btn-sm variant-soft" on:click={() => invalidateAll()}
                    >{m.common_retry()}</button>
            </div>
        {/await}

        <section class="mb-10">
            <div class="flex flex-wrap items-center justify-between gap-2 mb-3">
                <h3 class="h3 text-lg font-semibold m-0">{m.analytics_recent_activities()}</h3>
                <a href="/app/analytics/activities" class="anchor text-sm flex items-center gap-1">
                    {m.common_see_all()}
                    <ArrowRightIcon size="14" />
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
                    {syncProgress ?? m.analytics_fetching_history()}
                </p>
            {:else}
                <p class="text-center opacity-70 italic py-6">
                    {m.analytics_no_activities()}
                </p>
            {/if}
        </section>

        <section class="mb-10">
            <div class="flex flex-wrap items-center justify-between gap-2 mb-3">
                <h3 class="h3 text-lg font-semibold m-0">{m.analytics_recent_reports()}</h3>
                <a href="/app/analytics/reports" class="anchor text-sm flex items-center gap-1">
                    {m.common_see_all()}
                    <ArrowRightIcon size="14" />
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
                                    href="/app/analytics/reports/{report.id}"
                                    data-sveltekit-preload-data="hover"
                                    class="block rounded-xl border border-surface-300 dark:border-surface-700 p-4 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors no-underline text-inherit">
                                    <div class="flex flex-wrap justify-between items-baseline gap-2">
                                        <h4 class="font-semibold">
                                            {m.report_week_of({
                                                period: formatReportPeriod(report.periodStart, report.periodEnd),
                                            })}
                                        </h4>
                                        <span class="text-xs opacity-60">
                                            {new Date(report.createdAt).toLocaleDateString(getLocale())}
                                        </span>
                                    </div>
                                    <p class="text-sm opacity-80 mt-1">{report.summaryPreview}</p>
                                </a>
                            </li>
                        {/each}
                    </ul>
                {:else}
                    <p class="text-center opacity-70 italic py-4">
                        {m.analytics_no_reports()}
                    </p>
                {/if}
            {:catch}
                <p class="text-center opacity-70 italic py-4">{m.analytics_reports_unavailable()}</p>
            {/await}
            <div class="flex justify-center mt-4">
                <button
                    type="button"
                    class="btn variant-filled-primary"
                    on:click={() => goto('/app/analytics/reports')}>
                    {m.analytics_generate_report()}
                </button>
            </div>
        </section>
    </div>

    <div class="md:w-3/4 m-auto pb-8">
        <p class="h3 font-bold mb-4 text-primary-700 dark:text-error-500 text-center">{m.analytics_like_app()}</p>
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
