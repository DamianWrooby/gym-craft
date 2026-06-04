<script lang="ts">
    import Seo from '$lib/components/seo/Seo.svelte';
    import { page } from '$app/stores';
    import { invalidate } from '$app/navigation';
    import { onMount } from 'svelte';
    import { getModalStore } from '@skeletonlabs/skeleton';
    import Card from '@components/card/Card.svelte';
    import Spinner from '$lib/components/loading/spinner/Spinner.svelte';
    import ActivityTypeIcon from '$lib/components/activity-type-icon/ActivityTypeIcon.svelte';
    import { makeToast } from '$lib/utils/toasts.js';
    import { getToastStore } from '@skeletonlabs/skeleton';
    import type { User } from '@/models/user/user.model';
    import { validateGarminLoginFormData } from '$lib/utils/form-validation';
    import { PACE_ACTIVITY_TYPES, formatPaceOrSpeed } from '$lib/utils/pace';
    import { isSyncStale } from '$lib/utils/sync-staleness';
    import { toIsoDate } from '$lib/utils/iso-week';
    import { runProxySync } from '$lib/garmin/run-proxy-sync';
    import { triggerGarminLoginModal, type GarminLoginResponse } from '$lib/garmin/garmin-login-modal';
    import type { AnalyticsPageData } from './+page.server';

    const user: User = $page.data.user;
    const modalStore = getModalStore();
    const toastStore = getToastStore();

    export let data: AnalyticsPageData;

    const PAGE_SIZE_OPTIONS = [5, 10, 20, 50];

    let syncing: boolean = false;
    let currentPage: number = 1;
    let pageSize: number = 10;

    const today = new Date();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(today.getDate() - 7);

    let startDate: string = toIsoDate(sevenDaysAgo);
    let endDate: string = toIsoDate(today);
    let dateError: string = '';

    $: maxDate = toIsoDate(new Date());

    $: filteredActivities = data.activities.filter((a) => {
        const day = a.startTime.slice(0, 10);
        return day >= startDate && day <= endDate;
    });
    $: totalPages = filteredActivities.length ? Math.ceil(filteredActivities.length / pageSize) : 1;
    $: paginated = filteredActivities.slice((currentPage - 1) * pageSize, currentPage * pageSize);
    $: if (currentPage > totalPages) currentPage = totalPages;

    function validateDates(): boolean {
        if (!startDate || !endDate) {
            dateError = 'Please select both start and end dates';
            return false;
        }
        if (startDate > endDate) {
            dateError = 'Start date must be before or equal to end date';
            return false;
        }
        if (endDate > maxDate) {
            dateError = 'End date cannot be in the future';
            return false;
        }
        dateError = '';
        return true;
    }

    onMount(async () => {
        modalStore.clear();
        if (data.needsInitialSync) {
            await runSync({ blocking: true });
        } else if (isSyncStale(data.lastSyncedAt)) {
            void runSync({ blocking: false });
        }
    });

    async function runSync(opts: { blocking: boolean; password?: string }) {
        if (syncing) return;
        syncing = true;

        try {
            const result = await runProxySync({
                userId: user.id,
                garminEmail: data.garminEmail,
                syncState: { backfillComplete: !data.needsInitialSync, lastSyncedAt: data.lastSyncedAt },
                password: opts.password,
            });

            if (result.ok) {
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
                // Sync state advanced since load — refresh data so the next attempt uses the right window.
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
        const formValidationError = validateGarminLoginFormData(loginFormData);
        if (formValidationError) {
            makeToast(toastStore, 'Invalid form data', 'variant-filled-error');
            return;
        }
        await runSync({ blocking: true, password: loginFormData.password });
    }

    function formatDistance(meters: number | null): string {
        if (!meters) return '—';
        return `${(meters / 1000).toFixed(2)} km`;
    }
    function formatDuration(seconds: number | null): string {
        if (!seconds) return '—';
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        return `${m}:${s.toString().padStart(2, '0')}`;
    }
    function formatElevation(meters: number | null): string {
        if (meters === undefined || meters === null) return '—';
        return `${Math.round(meters)} m`;
    }
    function formatHr(bpm: number | null): string {
        if (!bpm) return '—';
        return `${Math.round(bpm)} bpm`;
    }
    function formatCalories(kcal: number | null): string {
        if (!kcal) return '—';
        return `${Math.round(kcal)}`;
    }
    function formatActivityDate(iso: string): { month: string; day: string; year: string } {
        const d = new Date(iso);
        return {
            month: d.toLocaleString('en-US', { month: 'short' }),
            day: d.getDate().toString(),
            year: d.getFullYear().toString(),
        };
    }
    function formatActivityType(typeKey: string): string {
        return typeKey.replace(/_/g, ' ').toUpperCase();
    }
    function formatLastSynced(iso: string | null): string {
        if (!iso) return 'never';
        const d = new Date(iso);
        return d.toLocaleString();
    }
</script>

<Seo title="Analytics | GymCraft™" metaDescription="Training analytics and insights." />

<Card width="3/4">
    <div class="md:w-3/4 m-auto pb-8">
        <div class="flex justify-end pt-6">
            <a href="/app/running/reports" class="btn variant-soft-primary">View weekly reports →</a>
        </div>
        <h2 class="h2 text-center text-xl py-4">Garmin Activities</h2>

        <div class="flex flex-col md:flex-row gap-4 justify-center items-center md:items-end mb-2">
            <label class="label">
                <span>Start date</span>
                <input type="date" class="input" bind:value={startDate} max={endDate || maxDate} disabled={syncing} />
            </label>
            <label class="label">
                <span>End date</span>
                <input
                    type="date"
                    class="input"
                    bind:value={endDate}
                    min={startDate}
                    max={maxDate}
                    disabled={syncing} />
            </label>
            <button
                type="button"
                class="btn variant-filled-primary"
                disabled={syncing}
                on:click={() => {
                    if (validateDates()) currentPage = 1;
                }}>
                Apply filter
            </button>
        </div>
        {#if dateError}
            <p class="text-error-500 text-center mb-2">{dateError}</p>
        {/if}

        <div class="flex flex-row items-center justify-center gap-3 text-sm opacity-80 mb-4">
            <span>Last synced: {formatLastSynced(data.lastSyncedAt)}</span>
            <button
                type="button"
                class="btn btn-sm variant-soft-primary"
                disabled={syncing}
                on:click={() => runSync({ blocking: false })}>
                {syncing ? 'Syncing…' : 'Sync now'}
            </button>
        </div>

        {#if syncing && data.activities.length === 0}
            <p class="text-center mb-2">Fetching your Garmin history…</p>
            <Spinner size={10} />
        {:else if filteredActivities.length}
            <ul class="list border rounded-2xl border-surface-900 dark:border-surface-500 mt-4">
                {#each paginated as activity (activity.id)}
                    {@const date = formatActivityDate(activity.startTime)}
                    <li
                        class="group !m-0 text-surface-500 dark:text-tertiary-500 border-b-1 first:rounded-t-2xl last:rounded-b-2xl rounded-none odd:bg-surface-200 dark:odd:bg-surface-900 even:bg-surface-300 dark:even:bg-surface-800 hover:bg-white dark:hover:bg-surface-600">
                        <a
                            href="/app/running/activities/{activity.garminActivityId}"
                            data-sveltekit-preload-data="hover"
                            class="block px-4 py-3 no-underline text-inherit">
                            <div class="flex flex-row items-center gap-3 flex-wrap">
                                <div class="flex flex-row items-center gap-2 w-28 shrink-0">
                                    <ActivityTypeIcon typeKey={activity.activityType} size={22} />
                                    <div class="flex flex-col leading-tight">
                                        <span class="font-semibold">{date.month} {date.day}</span>
                                        <span class="text-xs opacity-70">{date.year}</span>
                                    </div>
                                </div>
                                <div class="flex flex-col leading-tight flex-1 min-w-[10rem]">
                                    <span class="font-semibold text-surface-900 dark:text-tertiary-200">
                                        {activity.activityName ?? '—'}
                                    </span>
                                    <span class="text-xs opacity-70">
                                        {formatActivityType(activity.activityType)}
                                    </span>
                                </div>
                                <div class="flex flex-col leading-tight w-24">
                                    <span class="font-semibold">{formatDistance(activity.distanceM)}</span>
                                    <span class="text-xs opacity-70">DISTANCE</span>
                                </div>
                                <div class="flex flex-col leading-tight w-20">
                                    <span class="font-semibold">{formatDuration(activity.durationSec)}</span>
                                    <span class="text-xs opacity-70">TIME</span>
                                </div>
                                <div class="flex flex-col leading-tight w-24">
                                    <span class="font-semibold">
                                        {formatPaceOrSpeed(activity.averageSpeed ?? undefined, activity.activityType)}
                                    </span>
                                    <span class="text-xs opacity-70">
                                        {PACE_ACTIVITY_TYPES.has(activity.activityType) ? 'AVG PACE' : 'AVG SPEED'}
                                    </span>
                                </div>
                                <div class="flex flex-col leading-tight w-20">
                                    <span class="font-semibold">{formatElevation(activity.elevationGainM)}</span>
                                    <span class="text-xs opacity-70">ELEV GAIN</span>
                                </div>
                                <div class="flex flex-col leading-tight w-20">
                                    <span class="font-semibold">{formatHr(activity.averageHr)}</span>
                                    <span class="text-xs opacity-70">AVG HR</span>
                                </div>
                                <div class="flex flex-col leading-tight w-20">
                                    <span class="font-semibold">{formatCalories(activity.calories)}</span>
                                    <span class="text-xs opacity-70">CALORIES</span>
                                </div>
                            </div>
                        </a>
                    </li>
                {/each}
            </ul>
            <div class="flex flex-row flex-wrap justify-center items-center gap-3 mt-4">
                <label class="flex flex-row items-center gap-2 text-sm">
                    <span>Per page:</span>
                    <select class="select select-sm w-auto" bind:value={pageSize} on:change={() => (currentPage = 1)}>
                        {#each PAGE_SIZE_OPTIONS as option}
                            <option value={option}>{option}</option>
                        {/each}
                    </select>
                </label>
                {#if totalPages > 1}
                    <button
                        type="button"
                        class="btn btn-sm variant-soft"
                        disabled={currentPage === 1}
                        on:click={() => (currentPage = Math.max(1, currentPage - 1))}>
                        Previous
                    </button>
                    <span class="text-sm">Page {currentPage} of {totalPages}</span>
                    <button
                        type="button"
                        class="btn btn-sm variant-soft"
                        disabled={currentPage === totalPages}
                        on:click={() => (currentPage = Math.min(totalPages, currentPage + 1))}>
                        Next
                    </button>
                {/if}
                <span class="text-sm opacity-70">({filteredActivities.length} in range)</span>
            </div>
        {:else}
            <p class="text-center mt-4">No activities in the selected date range.</p>
        {/if}
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
