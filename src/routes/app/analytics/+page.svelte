<script lang="ts">
    import Seo from '$lib/components/seo/Seo.svelte';
    import { page } from '$app/stores';
    import { onMount } from 'svelte';
    import Card from '@components/card/Card.svelte';
    import Spinner from '$lib/components/loading/spinner/Spinner.svelte';
    import { makeToast } from '$lib/utils/toasts.js';
    import { getToastStore } from '@skeletonlabs/skeleton';
    import type { Plan } from '@/models/plan/plan.model';
    import type { User } from '@/models/user/user.model';
    import CtaButton from '$lib/components/cta-button/CtaButton.svelte';

    interface TableRow {
        id: string;
        position: number;
        name: string;
        editedName: string;
        createdAt: string;
    }

    const user: User = $page.data.user;

    const toastStore = getToastStore();

    let workouts: Plan[];
    let tableRows: TableRow[];
    let isLoading: boolean = true;

    onMount(async () => {
        isLoading = true;
        workouts = await getWorkouts();
        tableRows = generateTableRows(workouts);
        isLoading = false;
    });

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
