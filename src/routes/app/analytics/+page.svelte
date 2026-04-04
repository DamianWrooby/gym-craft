<script lang="ts">
    import Seo from '$lib/components/seo/Seo.svelte';
    import { page } from '$app/stores';
    import { onMount } from 'svelte';
    import { getModalStore, type ModalSettings, type ModalComponent } from '@skeletonlabs/skeleton';
    import Card from '@components/card/Card.svelte';
    import Spinner from '$lib/components/loading/spinner/Spinner.svelte';
    import { makeToast } from '$lib/utils/toasts.js';
    import { getToastStore } from '@skeletonlabs/skeleton';
    import { to } from 'await-to-js';
    import type { Plan } from '@/models/plan/plan.model';
    import type { User } from '@/models/user/user.model';
    import type { GarminActivity, FetchActivitiesParams } from '@/models/garmin/activity.model';
    import { validateGarminLoginFormData } from '$lib/utils/form-validation';
    import GarminLoginForm from '$lib/components/garmin-login-form/GarminLoginForm.svelte';
    import CtaButton from '$lib/components/cta-button/CtaButton.svelte';

    interface TableRow {
        id: string;
        position: number;
        name: string;
        editedName: string;
        createdAt: string;
    }

    const user: User = $page.data.user;

    const modalStore = getModalStore();
    const modalComponent: ModalComponent = { ref: GarminLoginForm };
    const toastStore = getToastStore();

    let workouts: Plan[];
    let tableRows: TableRow[];
    let isLoading: boolean = true;

    let activities: GarminActivity[] = [];
    let activitiesLoading: boolean = false;
    let activitiesParams: FetchActivitiesParams | null = null;

    onMount(async () => {
        clearModals();
        isLoading = true;
        workouts = await getWorkouts();
        tableRows = generateTableRows(workouts);
        isLoading = false;
    });

    function clearModals() {
        modalStore.clear();
    }

    async function getWorkouts() {
        if (!user) return [];
        return await fetchWorkouts(user.id);
    }

    function formatDate(date: Date): string {
        return `${date.toDateString()} ${date.toLocaleTimeString()}`;
    }

    function generateTableRows(workouts: Plan[]): TableRow[] {
        return workouts.map((workout, index) => ({
            id: workout.id,
            position: index + 1,
            name: workout.name,
            editedName: workout.name,
            createdAt: formatDate(new Date(workout.createdAt)),
        }));
    }

    async function fetchWorkouts(userId: string): Promise<Plan[]> {
        try {
            const response: Response = await fetch(`/api/user/${userId}/plans`, {
                method: 'GET',
            });
            if (!response.ok) {
                const res = await response.json();
                throw new Error(res.message);
            }
            const res: { plans: Plan[] } = await response.json();
            return res.plans;
        } catch (error) {
            makeToast(toastStore, 'Cannot fetch plans', 'variant-filled-error');
            console.error(error);
            return [];
        }
    }

    // --- Garmin Activities ---

    type LoginFormData = { email: string; password: string };

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

        activities = result.data || [];
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
    <h2 class="h2 text-center text-xl py-10">Generated plans</h2>
    <div class="md:w-3/4 m-auto pb-8">
        {#if tableRows?.length}
            <ul class="list border rounded-2xl border-surface-900 dark:border-surface-500">
                {#each tableRows as workout}
                    <li
                        class="group !m-0 px-4 py-2 text-surface-500 dark:text-tertiary-500 border-b-1 first:rounded-t-2xl last:rounded-b-2xl rounded-none odd:bg-surface-200 dark:odd:bg-surface-900 even:bg-surface-300 dark:even:bg-surface-800 hover:bg-white dark:hover:bg-surface-600">
                        <span class="w-1/12">#{workout.position}</span>
                        <span class="w-5/12 pl-3">{workout.name}</span>
                        <span class="w-6/12 text-right">{workout.createdAt}</span>
                    </li>
                {/each}
            </ul>
        {:else if !isLoading}
            <p class="text-center">No plans found</p>
            <CtaButton url="/app/create-plan" text="Create new plan" />
        {:else}
            <Spinner size={10} />
        {/if}
    </div>
    <div class="md:w-3/4 m-auto pb-8">
        <h2 class="h2 text-center text-xl py-10">Garmin Activities</h2>
        {#if activitiesLoading}
            <Spinner size={10} />
        {:else if activities.length}
            <p class="text-center text-surface-500">{activities.length} activities loaded</p>
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
