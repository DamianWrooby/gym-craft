<script lang="ts">
    import Seo from '$lib/components/seo/Seo.svelte';
    import { goto } from '$app/navigation';
    import { ArrowLeftIcon } from 'svelte-feather-icons';
    import Card from '@components/card/Card.svelte';
    import ActivityRow from '$lib/components/activity-list/ActivityRow.svelte';
    import { toIsoDate } from '$lib/utils/iso-week';
    import type { ActivityListPageData } from './+page.server';

    export let data: ActivityListPageData;

    const PAGE_SIZE_OPTIONS = [5, 10, 20, 50];

    let currentPage = 1;
    let pageSize = 10;

    const today = new Date();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(today.getDate() - 7);

    let startDate = toIsoDate(sevenDaysAgo);
    let endDate = toIsoDate(today);
    let dateError = '';

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
            <button
                type="button"
                class="btn variant-filled-primary"
                on:click={() => {
                    if (validateDates()) currentPage = 1;
                }}>
                Apply filter
            </button>
        </div>
        {#if dateError}
            <p class="text-error-500 text-center mb-2">{dateError}</p>
        {/if}

        <p class="text-center text-sm opacity-70 mb-4">Last synced: {formatLastSynced(data.lastSyncedAt)}</p>

        {#if filteredActivities.length}
            <ul class="list border rounded-2xl border-surface-900 dark:border-surface-500 mt-4">
                {#each paginated as activity (activity.id)}
                    <ActivityRow {activity} />
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
</Card>
