<script lang="ts">
    import { page } from '$app/stores';
    import { goto } from '$app/navigation';
    import { onMount } from 'svelte';
    import { getModalStore, type ModalSettings } from '@skeletonlabs/skeleton';
    import Card from '@components/card/Card.svelte';
    import Spinner from '$lib/components/loading/spinner/Spinner.svelte';
    import { Edit2Icon, CheckIcon, XIcon, TrashIcon, EyeIcon } from 'svelte-feather-icons';
    import { makeToast } from '$lib/utils/toasts.js';
    import { getToastStore } from '@skeletonlabs/skeleton';
    import { appConfig } from '@/constants/app.constants';
    import type { Plan } from '@/models/plan/plan.model';
    import type { User } from '@/models/user/user.model';
    import CtaButton from '$lib/components/cta-button/CtaButton.svelte';

    interface MappedPlan {
        id: string;
        position: number;
        name: string;
        edittedName: string;
        createdAt: string;
    }

    const user: User = $page.data.user;

    const modalStore = getModalStore();
    const toastStore = getToastStore();

    let plans: Plan[];
    let tableRows: MappedPlan[];
    let isLoading: boolean = true;

    let editNameEnabledIndex: number = -1;

    onMount(async () => {
        clearModals();
        isLoading = true;
        plans = await getPlans();
        tableRows = generateTableRows(plans);
        isLoading = false;
    });

    function clearModals() {
        modalStore.clear();
    }

    async function getPlans() {
        return await fetchPlans(user.id);
    }

    function formatDate(date: Date): string {
        return `${date.toDateString()} ${date.toLocaleTimeString()}`;
    }

    function generateTableRows(plans: Plan[]): MappedPlan[] {
        return plans.map((plan, index) => ({
            id: plan.id,
            position: index + 1,
            name: plan.name,
            edittedName: plan.name,
            createdAt: formatDate(new Date(plan.createdAt)),
        }));
    }

    async function saveName(plan: MappedPlan) {
        const initialName = plan.name;
        plan.name = plan.edittedName;
        editNameEnabledIndex = -1;

        const body = JSON.stringify({ name: plan.edittedName, userId: user.id });
        try {
            const response: Response = await fetch(`${appConfig.plansApiUrl}/${plan.id}`, {
                method: 'POST',
                body,
            });
            if (!response.ok) {
                const { error } = await response.json();
                makeToast(toastStore, error, 'variant-filled-error');
                plan.name = initialName;
            }
        } catch (error) {
            makeToast(toastStore, 'Cannot save name due to server error', 'variant-filled-error');
            console.error(error);
            plan.name = initialName;
        }
    }

    function cancelNameChange(index: number) {
        editNameEnabledIndex = -1;
        tableRows[index].edittedName = tableRows[index].name;
    }

    function onDeleteClick(plan: MappedPlan) {
        const modal: ModalSettings = {
            type: 'confirm',
            title: 'Delete plan',
            body: `<p>Are you sure you want to delete plan: ${plan.name}?</p><br><p>This action will not increase your plan limit.</p>`,
            buttonTextConfirm: 'Delete',
            response: async (response: boolean) => {
                if (response) {
                    await deletePlan(plan);
                }
            },
        };
        modalStore.trigger(modal);
    }

    async function fetchPlans(userId: string): Promise<Plan[]> {
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

    async function deletePlan(plan: MappedPlan) {
        try {
            const body = JSON.stringify({ userId: user.id });
            const response: Response = await fetch(`${appConfig.plansApiUrl}/${plan.id}`, {
                method: 'DELETE',
                body,
            });
            if (!response.ok) {
                const { error } = await response.json();
                makeToast(toastStore, error, 'variant-filled-error');
            }
            makeToast(toastStore, 'Selected plan has been removed', 'variant-filled-warning');
            plans = (await fetchPlans(user.id)) || [];
            tableRows = generateTableRows(plans);
        } catch (error) {
            makeToast(toastStore, 'Cannot delete plan', 'variant-filled-error');
            console.error(error);
        }
    }

    function showPlan(plan: MappedPlan) {
        goto(`/app/my-plans/${plan.id}`);
    }
</script>

<Card width="3/4">
    <h2 class="h2 text-center text-xl py-10">Generated plans</h2>
    <div class="md:w-3/4 m-auto pb-8">
        {#if tableRows?.length}
            <ul class="list border rounded-2xl border-surface-900 dark:border-surface-500">
                {#each tableRows as plan, index}
                    <li
                        class="group !m-0 px-4 py-2 text-surface-500 dark:text-tertiary-500 border-b-1 first:rounded-t-2xl last:rounded-b-2xl rounded-none odd:bg-surface-200 dark:odd:bg-surface-900 even:bg-surface-300 dark:even:bg-surface-800 hover:bg-white dark:hover:bg-surface-600">
                        <span class="w-1/12">#{plan.position}</span>
                        <div class="w-5/12 flex flex-row items-center">
                            {#if editNameEnabledIndex === index}
                                <input
                                    class="input"
                                    title="Plan name input"
                                    type="text"
                                    bind:value={plan.edittedName}
                                    required
                                    aria-required />
                                <button type="button" class="py-2 px-1" on:click={() => saveName(plan)}>
                                    <CheckIcon class="w-4 text-success-700 hover:text-success-500 transition-colors" />
                                </button>
                                <button type="button" class="py-2 px-1" on:click={() => cancelNameChange(index)}>
                                    <XIcon class="w-4 text-error-700 hover:text-error-500 transition-colors" />
                                </button>
                            {:else}
                                <span class="pl-3 pr-2">{plan.name}</span>
                                <button type="button" class="p-2" on:click={() => (editNameEnabledIndex = index)}>
                                    <Edit2Icon
                                        class="w-4 invisible group-hover:visible hover:text-tertiary-100 transition-colors" />
                                </button>
                            {/if}
                        </div>
                        <div class="w-6/12 flex flex-row justify-end items-center">
                            <button type="button" class="p-2" on:click={() => showPlan(plan)}>
                                <EyeIcon
                                    class="w-4 invisible group-hover:visible hover:text-tertiary-100 transition-colors" />
                            </button>
                            <button type="button" class="p-2" on:click={() => onDeleteClick(plan)}>
                                <TrashIcon
                                    class="w-4 invisible group-hover:visible text-error-700 hover:text-error-500 transition-colors" />
                            </button>
                        </div>
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
