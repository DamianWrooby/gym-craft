<script lang="ts">
    import Seo from '$lib/components/seo/Seo.svelte';
    import { afterNavigate, goto } from '$app/navigation';
    import { ArrowLeftIcon } from 'svelte-feather-icons';
    import Card from '@components/card/Card.svelte';
    import ActivityRow from '$lib/components/activity-list/ActivityRow.svelte';
    import { toIsoDate } from '$lib/utils/iso-week';
    import { activityListSearch } from '$lib/utils/activity-list-query';
    import type { ActivityListPageData } from './+page.server';

    export let data: ActivityListPageData;

    // The window and the revealed row count both live in the URL, so the server decides what
    // this page shows. That is what lets a reload — or coming back from an activity detail
    // page — land on the same rows at the same scroll position.
    let startDate = data.from;
    let endDate = data.to;
    let dateError = '';
    let loadingMore = false;

    $: maxDate = toIsoDate(new Date());
    // Re-sync the inputs whenever a navigation lands: the URL is the truth, and any edit the
    // user had not applied yet is exactly what should be discarded.
    $: syncInputs(data.from, data.to);

    function syncInputs(from: string, to: string) {
        startDate = from;
        endDate = to;
    }

    afterNavigate(() => {
        loadingMore = false;
    });

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

    function applyFilter() {
        if (!validateDates()) return;
        // A new window starts from the first batch again.
        goto(activityListSearch(startDate, endDate, data.pageSize), { noScroll: true, keepFocus: true });
    }

    function loadMore() {
        loadingMore = true;
        goto(activityListSearch(data.from, data.to, data.shown + data.pageSize), {
            noScroll: true,
            keepFocus: true,
            replaceState: true,
        });
    }

    function formatLastSynced(iso: string | null): string {
        if (!iso) return 'never';
        return new Date(iso).toLocaleString();
    }
</script>

<Seo title="Activities | GymCraft&#x2122;" metaDescription="Browse your Garmin activities." />

<Card width="3/4">
    <div class="flex justify-between items-center pb-2">
        <button type="button" on:click={() => goto('/app/running/analytics')} aria-label="Back to analytics">
            <ArrowLeftIcon class="cursor-pointer text-surface-400 hover:text-surface-300" />
        </button>
    </div>

    <div class="md:w-3/4 m-auto pb-8">
        <h2 class="h2 text-center text-xl py-4">Garmin Activities</h2>

        <div class="flex flex-col md:flex-row gap-4 justify-center items-center md:items-end mb-2">
            <label class="label">
                <span>Start date</span>
                <input type="date" class="input" bind:value={startDate} max={endDate || maxDate} />
            </label>
            <label class="label">
                <span>End date</span>
                <input type="date" class="input" bind:value={endDate} min={startDate} max={maxDate} />
            </label>
            <button type="button" class="btn variant-filled-primary" on:click={applyFilter}>Apply filter</button>
        </div>
        {#if dateError}
            <p class="text-error-500 text-center mb-2">{dateError}</p>
        {/if}

        <p class="text-center text-sm opacity-70 mb-4">Last synced: {formatLastSynced(data.lastSyncedAt)}</p>

        {#if data.activities.length}
            <ul class="list border rounded-2xl border-surface-900 dark:border-surface-500 mt-4">
                {#each data.activities as activity (activity.id)}
                    <ActivityRow {activity} />
                {/each}
            </ul>
            <div class="flex flex-col justify-center items-center gap-2 mt-4">
                <p class="text-sm opacity-70" aria-live="polite">
                    Showing {data.activities.length} of {data.total} in range
                </p>
                {#if data.atMaxShown}
                    <p class="text-sm text-center opacity-70">
                        That is as far as this list goes — narrow the date range to see older activities.
                    </p>
                {:else if data.hasMore}
                    <button type="button" class="btn btn-sm variant-soft" disabled={loadingMore} on:click={loadMore}>
                        {loadingMore ? 'Loading…' : 'Load more'}
                    </button>
                {/if}
            </div>
        {:else}
            <p class="text-center mt-4">No activities in the selected date range.</p>
        {/if}
    </div>
</Card>
