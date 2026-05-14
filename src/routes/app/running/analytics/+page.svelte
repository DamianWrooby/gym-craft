<script lang="ts">
    import Seo from '$lib/components/seo/Seo.svelte';
    import { page } from '$app/stores';
    import { onMount } from 'svelte';
    import { getModalStore, type ModalSettings, type ModalComponent } from '@skeletonlabs/skeleton';
    import Card from '@components/card/Card.svelte';
    import Spinner from '$lib/components/loading/spinner/Spinner.svelte';
    import ActivityTypeIcon from '$lib/components/activity-type-icon/ActivityTypeIcon.svelte';
    import { makeToast } from '$lib/utils/toasts.js';
    import { getToastStore } from '@skeletonlabs/skeleton';
    import { to } from 'await-to-js';
    import type { User } from '@/models/user/user.model';
    import type { GarminActivity, FetchActivitiesParams } from '@/models/garmin/activity.model';
    import { validateGarminLoginFormData } from '$lib/utils/form-validation';
    import GarminLoginForm from '$lib/components/garmin-login-form/GarminLoginForm.svelte';

    type LoginFormData = { email: string; password: string };

    const user: User = $page.data.user;

    const modalStore = getModalStore();
    const modalComponent: ModalComponent = { ref: GarminLoginForm };
    const toastStore = getToastStore();

    const PACE_TYPES = ['running', 'walking', 'hiking', 'treadmill_running', 'trail_running'];

    const PAGE_SIZE_OPTIONS = [5, 10, 20, 50];

    let activitiesLoading: boolean = false;
    let activitiesParams: FetchActivitiesParams | null = null;
    let activities: GarminActivity[] | null = null;
    let hasFetched: boolean = false;
    let currentPage: number = 1;
    let pageSize: number = 10;

    $: totalPages = activities?.length ? Math.ceil(activities.length / pageSize) : 1;
    $: paginatedActivities = activities ? activities.slice((currentPage - 1) * pageSize, currentPage * pageSize) : [];
    $: if (currentPage > totalPages) currentPage = totalPages;

    function formatDate(date: Date): string {
        return date.toISOString().slice(0, 10);
    }

    const today = new Date();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(today.getDate() - 7);

    let startDate: string = formatDate(sevenDaysAgo);
    let endDate: string = formatDate(today);
    let dateError: string = '';

    $: maxDate = formatDate(new Date());

    onMount(() => {
        modalStore.clear();
    });

    function formatDistance(meters: number | undefined): string {
        if (!meters) return '—';
        return `${(meters / 1000).toFixed(2)} km`;
    }

    function formatDuration(seconds: number | undefined): string {
        if (!seconds) return '—';
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        return `${m}:${s.toString().padStart(2, '0')}`;
    }

    function formatPaceOrSpeed(activity: GarminActivity): string {
        const speed = activity.averageSpeed;
        if (!speed || speed <= 0) return '—';
        if (PACE_TYPES.includes(activity.activityType.typeKey)) {
            const secPerKm = 1000 / speed;
            const m = Math.floor(secPerKm / 60);
            const s = Math.floor(secPerKm % 60);
            return `${m}:${s.toString().padStart(2, '0')} /km`;
        }
        return `${(speed * 3.6).toFixed(1)} km/h`;
    }

    function formatElevation(meters: number | undefined): string {
        if (meters === undefined || meters === null) return '—';
        return `${Math.round(meters)} m`;
    }

    function formatHr(bpm: number | undefined): string {
        if (!bpm) return '—';
        return `${Math.round(bpm)} bpm`;
    }

    function formatCalories(kcal: number | undefined): string {
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

    async function fetchActivities(
        params: FetchActivitiesParams,
    ): Promise<{ data?: GarminActivity[]; message?: string; code?: string }> {
        const [error, response] = await to(
            fetch(`/api/user/${user.id}/garmin/activities`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(params),
            }),
        );

        if (error || !response) {
            return { message: error?.message || 'Failed to fetch activities' };
        }

        const [parseError, data] = await to(response.json());
        if (parseError) return { message: 'Error parsing response' };

        if (!response.ok) {
            return { message: data?.message || 'Failed to fetch activities', code: data?.code };
        }

        return { data: data?.data };
    }

    async function handleFetchActivities(params: FetchActivitiesParams) {
        activitiesLoading = true;
        activitiesParams = params;

        const result = await fetchActivities(params);

        if (result.message) {
            if (result.code === 'INVALID_TOKEN') {
                makeToast(
                    toastStore,
                    'Invalid token <br> Please log in to your Garmin account',
                    'variant-filled-warning',
                );
                activitiesLoading = false;
                openGarminLoginModal();
                return;
            }

            if (result.code === 'GARMIN_EMAIL_NOT_CONFIGURED') {
                makeToast(
                    toastStore,
                    'Garmin email not configured <br> Please set up Garmin integration in your account settings',
                    'variant-filled-warning',
                );
                activitiesLoading = false;
                return;
            }

            makeToast(toastStore, result.message, 'variant-filled-error');
            activitiesLoading = false;
            return;
        }

        activities = result.data ?? [];
        hasFetched = true;
        currentPage = 1;
        console.log('Garmin activities:', activities);
        activitiesLoading = false;
    }

    function openGarminLoginModal() {
        const modal: ModalSettings = {
            type: 'component',
            title: 'Sign in to Garmin Connect',
            body: 'Provide credentials to connect to your Garmin Connect account and fetch activities.',
            buttonTextCancel: 'Cancel',
            buttonTextConfirm: 'Login and fetch activities',
            component: modalComponent,
            response: handleGarminLoginResponse,
        };
        modalStore.trigger(modal);
    }

    async function handleGarminLoginResponse(loginFormData: LoginFormData | false) {
        if (!loginFormData) {
            activitiesLoading = false;
            return;
        }

        const formValidationError = validateGarminLoginFormData(loginFormData);
        if (formValidationError) {
            makeToast(toastStore, 'Invalid form data', 'variant-filled-error');
            activitiesLoading = false;
            return;
        }

        if (activitiesParams) {
            await handleFetchActivities({ ...activitiesParams, password: loginFormData.password });
        }
    }
</script>

<Seo title="Analytics | GymCraft™" metaDescription="Training analytics and insights." />

<Card width="3/4">
    <div class="md:w-3/4 m-auto pb-8">
        <h2 class="h2 text-center text-xl py-10">Garmin Activities</h2>
        <div class="flex flex-col md:flex-row gap-4 justify-center items-center md:items-end mb-4">
            <label class="label">
                <span>Start date</span>
                <input
                    type="date"
                    class="input"
                    bind:value={startDate}
                    max={endDate || maxDate}
                    disabled={activitiesLoading} />
            </label>
            <label class="label">
                <span>End date</span>
                <input
                    type="date"
                    class="input"
                    bind:value={endDate}
                    min={startDate}
                    max={maxDate}
                    disabled={activitiesLoading} />
            </label>
            <button
                type="button"
                class="btn variant-filled-primary"
                disabled={activitiesLoading}
                on:click={() => {
                    if (validateDates()) handleFetchActivities({ startDate, endDate });
                }}>
                Fetch activities
            </button>
        </div>
        {#if dateError}
            <p class="text-error-500 text-center mb-2">{dateError}</p>
        {/if}

        {#if activitiesLoading}
            <Spinner size={10} />
        {:else if activities?.length}
            <ul class="list border rounded-2xl border-surface-900 dark:border-surface-500 mt-4">
                {#each paginatedActivities as activity}
                    {@const date = formatActivityDate(activity.startTimeLocal)}
                    <li
                        class="group !m-0 px-4 py-3 text-surface-500 dark:text-tertiary-500 border-b-1 first:rounded-t-2xl last:rounded-b-2xl rounded-none odd:bg-surface-200 dark:odd:bg-surface-900 even:bg-surface-300 dark:even:bg-surface-800 hover:bg-white dark:hover:bg-surface-600">
                        <div class="flex flex-row items-center gap-3 flex-wrap">
                            <div class="flex flex-row items-center gap-2 w-28 shrink-0">
                                <ActivityTypeIcon typeKey={activity.activityType.typeKey} size={22} />
                                <div class="flex flex-col leading-tight">
                                    <span class="font-semibold">{date.month} {date.day}</span>
                                    <span class="text-xs opacity-70">{date.year}</span>
                                </div>
                            </div>
                            <div class="flex flex-col leading-tight flex-1 min-w-[10rem]">
                                <span class="font-semibold text-surface-900 dark:text-tertiary-200"
                                    >{activity.activityName}</span>
                                <span class="text-xs opacity-70"
                                    >{formatActivityType(activity.activityType.typeKey)}</span>
                            </div>
                            <div class="flex flex-col leading-tight w-24">
                                <span class="font-semibold">{formatDistance(activity.distance)}</span>
                                <span class="text-xs opacity-70">DISTANCE</span>
                            </div>
                            <div class="flex flex-col leading-tight w-20">
                                <span class="font-semibold">{formatDuration(activity.duration)}</span>
                                <span class="text-xs opacity-70">TIME</span>
                            </div>
                            <div class="flex flex-col leading-tight w-24">
                                <span class="font-semibold">{formatPaceOrSpeed(activity)}</span>
                                <span class="text-xs opacity-70">
                                    {PACE_TYPES.includes(activity.activityType.typeKey)
                                        ? 'AVG PACE'
                                        : 'AVG SPEED'}
                                </span>
                            </div>
                            <div class="flex flex-col leading-tight w-20">
                                <span class="font-semibold">{formatElevation(activity.elevationGain)}</span>
                                <span class="text-xs opacity-70">ELEV GAIN</span>
                            </div>
                            <div class="flex flex-col leading-tight w-20">
                                <span class="font-semibold">{formatHr(activity.averageHR)}</span>
                                <span class="text-xs opacity-70">AVG HR</span>
                            </div>
                            <div class="flex flex-col leading-tight w-20">
                                <span class="font-semibold">{formatCalories(activity.calories)}</span>
                                <span class="text-xs opacity-70">CALORIES</span>
                            </div>
                        </div>
                    </li>
                {/each}
            </ul>
            <div class="flex flex-row flex-wrap justify-center items-center gap-3 mt-4">
                <label class="flex flex-row items-center gap-2 text-sm">
                    <span>Per page:</span>
                    <select
                        class="select select-sm w-auto"
                        bind:value={pageSize}
                        on:change={() => (currentPage = 1)}>
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
                    <span class="text-sm">
                        Page {currentPage} of {totalPages}
                    </span>
                    <button
                        type="button"
                        class="btn btn-sm variant-soft"
                        disabled={currentPage === totalPages}
                        on:click={() => (currentPage = Math.min(totalPages, currentPage + 1))}>
                        Next
                    </button>
                {/if}
                <span class="text-sm opacity-70">({activities.length} total)</span>
            </div>
        {:else if hasFetched}
            <p class="text-center mt-4">No activities found for the selected date range</p>
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
