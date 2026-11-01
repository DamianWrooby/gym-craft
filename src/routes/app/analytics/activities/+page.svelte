<script lang="ts">
    import { m } from '$lib/paraglide/messages.js';
    import { getLocale } from '$lib/paraglide/runtime.js';
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
            dateError = m.activities_dates_required();
            return false;
        }
        if (startDate > endDate) {
            dateError = m.activities_start_after_end();
            return false;
        }
        if (endDate > maxDate) {
            dateError = m.activities_end_in_future();
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
        return new Date(iso).toLocaleString(getLocale());
    }
</script>

<Seo title={`${m.activities_heading()} | GymCraft™`} metaDescription="Browse your Garmin activities." />

<Card width="3/4">
    <div class="flex justify-between items-center pb-2">
        <button type="button" on:click={() => goto('/app/analytics')} aria-label={m.activities_back()}>
            <ArrowLeftIcon class="cursor-pointer text-surface-400 hover:text-surface-300" />
        </button>
    </div>

    <div class="md:w-3/4 m-auto pb-8">
        <h2 class="h2 text-center text-xl py-4">{m.activities_heading()}</h2>

        <div class="flex flex-col md:flex-row gap-4 justify-center items-center md:items-end mb-2">
            <label class="label">
                <span>{m.activities_start_date()}</span>
                <input type="date" class="input" bind:value={startDate} max={endDate || maxDate} />
            </label>
            <label class="label">
                <span>{m.activities_end_date()}</span>
                <input type="date" class="input" bind:value={endDate} min={startDate} max={maxDate} />
            </label>
            <button type="button" class="btn variant-filled-primary" on:click={applyFilter}
                >{m.activities_apply_filter()}</button>
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
                    {m.activities_showing({ shown: data.activities.length, total: data.total })}
                </p>
                {#if data.atMaxShown}
                    <p class="text-sm text-center opacity-70">
                        {m.activities_max_shown()}
                    </p>
                {:else if data.hasMore}
                    <button type="button" class="btn btn-sm variant-soft" disabled={loadingMore} on:click={loadMore}>
                        {loadingMore ? m.common_loading() : m.common_load_more()}
                    </button>
                {/if}
            </div>
        {:else}
            <p class="text-center mt-4">{m.activities_none_in_range()}</p>
        {/if}
    </div>
</Card>
