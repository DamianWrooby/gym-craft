<script lang="ts">
    import { page } from '$app/stores';
    import { invalidateAll } from '$app/navigation';
    import { getToastStore } from '@skeletonlabs/skeleton';
    import Card from '@components/card/Card.svelte';
    import Seo from '$lib/components/seo/Seo.svelte';
    import AthleteProfileForm from '$lib/components/athlete-profile/AthleteProfileForm.svelte';
    import RunningGoalForm from '$lib/components/running-goal/RunningGoalForm.svelte';
    import { makeToast } from '$lib/utils/toasts';
    import { GOAL_TYPE_LABELS } from '@/constants/training-report.constants';
    import { to } from 'await-to-js';
    import type { User } from '@/models/user/user.model';
    import type { GoalType, Sex } from '@prisma/client';

    type GoalRow = {
        id: string;
        goalType: GoalType;
        targetEventName: string | null;
        targetEventDate: string | null;
        targetDistanceM: number | null;
        targetTimeSec: number | null;
        priority: number;
        notes: string | null;
    };

    type ProfileRow = {
        birthDate: string;
        sex: Sex;
        weightKg: number;
        heightCm: number;
        timezone: string;
        restingHR: number | null;
        maxHR: number | null;
        vo2max: number | null;
    };

    const user: User = $page.data.user;
    $: profile = $page.data.profile as ProfileRow | null;
    $: goals = $page.data.goals as GoalRow[];

    const toastStore = getToastStore();
    let savingProfile = false;
    let editingGoalId: string | 'new' | null = null;
    let savingGoal = false;

    async function saveProfile(
        e: CustomEvent<
            Partial<ProfileRow> & Pick<ProfileRow, 'birthDate' | 'sex' | 'weightKg' | 'heightCm' | 'timezone'>
        >,
    ) {
        savingProfile = true;
        const [err, response] = await to(
            fetch(`/api/user/${user.id}/athlete-profile`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(e.detail),
            }),
        );
        savingProfile = false;
        if (err || !response?.ok) {
            const message = response ? (await response.json())?.message : err?.message;
            makeToast(toastStore, message ?? 'Failed to save profile', 'variant-filled-error');
            return;
        }
        makeToast(toastStore, 'Profile saved', 'variant-filled-success');
        await invalidateAll();
    }

    async function saveGoal(e: CustomEvent<Partial<GoalRow>>, goalId: string | 'new') {
        savingGoal = true;
        const url =
            goalId === 'new' ? `/api/user/${user.id}/running-goals` : `/api/user/${user.id}/running-goals/${goalId}`;
        const method = goalId === 'new' ? 'POST' : 'PUT';
        const [err, response] = await to(
            fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(e.detail) }),
        );
        savingGoal = false;
        if (err || !response?.ok) {
            const message = response ? (await response.json())?.message : err?.message;
            makeToast(toastStore, message ?? 'Failed to save goal', 'variant-filled-error');
            return;
        }
        makeToast(toastStore, 'Goal saved', 'variant-filled-success');
        editingGoalId = null;
        await invalidateAll();
    }

    async function archiveGoal(goalId: string) {
        const [err, response] = await to(fetch(`/api/user/${user.id}/running-goals/${goalId}`, { method: 'DELETE' }));
        if (err || !response?.ok) {
            makeToast(toastStore, 'Failed to archive goal', 'variant-filled-error');
            return;
        }
        makeToast(toastStore, 'Goal archived', 'variant-filled-warning');
        await invalidateAll();
    }
</script>

<Seo title="Profile | GymCraft™" metaDescription="Athlete profile and running goals." />

<Card width="3/4">
    <div class="md:w-3/4 m-auto pb-8">
        <h1 class="h2 text-xl font-bold py-6">Athlete profile</h1>
        <AthleteProfileForm {profile} saving={savingProfile} on:save={saveProfile} />
    </div>

    <div class="md:w-3/4 m-auto pb-8">
        <div class="flex justify-between items-center py-4">
            <h2 class="h2 text-xl font-bold">Running goals</h2>
            {#if editingGoalId !== 'new'}
                <button class="btn variant-filled-primary" on:click={() => (editingGoalId = 'new')}> Add goal </button>
            {/if}
        </div>

        {#if editingGoalId === 'new'}
            <div class="border border-surface-300 dark:border-surface-700 rounded-xl p-4 mb-4">
                <RunningGoalForm
                    saving={savingGoal}
                    on:save={(e) => saveGoal(e, 'new')}
                    on:cancel={() => (editingGoalId = null)} />
            </div>
        {/if}

        {#if goals.length === 0 && editingGoalId !== 'new'}
            <p class="text-center opacity-70 italic">No goals yet.</p>
        {:else}
            <ul class="space-y-3">
                {#each goals as goal (goal.id)}
                    <li class="border border-surface-300 dark:border-surface-700 rounded-xl p-4">
                        {#if editingGoalId === goal.id}
                            <RunningGoalForm
                                {goal}
                                saving={savingGoal}
                                on:save={(e) => saveGoal(e, goal.id)}
                                on:cancel={() => (editingGoalId = null)} />
                        {:else}
                            <div class="flex justify-between items-start">
                                <div>
                                    <p class="font-semibold">
                                        {GOAL_TYPE_LABELS[goal.goalType]}
                                        {#if goal.targetEventName}— {goal.targetEventName}{/if}
                                    </p>
                                    <p class="text-xs opacity-70">
                                        Priority {goal.priority}
                                        {#if goal.targetEventDate}
                                            · {goal.targetEventDate}{/if}
                                        {#if goal.targetDistanceM}
                                            · {(goal.targetDistanceM / 1000).toFixed(2)} km{/if}
                                    </p>
                                    {#if goal.notes}
                                        <p class="text-sm opacity-80 mt-1">{goal.notes}</p>
                                    {/if}
                                </div>
                                <div class="flex gap-2">
                                    <button class="btn btn-sm variant-soft" on:click={() => (editingGoalId = goal.id)}>
                                        Edit
                                    </button>
                                    <button class="btn btn-sm variant-soft-error" on:click={() => archiveGoal(goal.id)}>
                                        Archive
                                    </button>
                                </div>
                            </div>
                        {/if}
                    </li>
                {/each}
            </ul>
        {/if}
    </div>
</Card>
