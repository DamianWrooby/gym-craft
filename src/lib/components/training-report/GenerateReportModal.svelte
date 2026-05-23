<script lang="ts">
    import { getModalStore } from '@skeletonlabs/skeleton';
    import { goto } from '$app/navigation';
    import { GOAL_TYPE_LABELS, REPORT_NOTES_MAX_LENGTH } from '@/constants/training-report.constants';
    import { addDays, isMonday } from '$lib/utils/iso-week';
    import type { GoalType } from '@prisma/client';

    export let goals: Array<{
        id: string;
        goalType: GoalType;
        targetEventName: string | null;
        priority: number;
    }> = [];

    const modalStore = getModalStore();

    function defaultMonday(): string {
        const today = new Date();
        const todayStr = today.toISOString().slice(0, 10);
        // Walk back until we hit a Monday last week.
        let cursor = todayStr;
        while (!isMonday(cursor)) cursor = addDays(cursor, -1);
        // That was this week's Monday — go back 7 more to last week's Monday.
        return addDays(cursor, -7);
    }

    let periodStart = defaultMonday();
    $: periodEnd = addDays(periodStart, 6);

    const primaryGoal = goals.find((g) => g.priority === 1) ?? goals[0];
    let selectedGoalIds: string[] = primaryGoal ? [primaryGoal.id] : [];
    let notes = '';
    let dateError = '';

    function toggleGoal(id: string) {
        selectedGoalIds = selectedGoalIds.includes(id)
            ? selectedGoalIds.filter((g) => g !== id)
            : [...selectedGoalIds, id];
    }

    function onSubmit() {
        if (!isMonday(periodStart)) {
            dateError = 'Period start must be a Monday';
            return;
        }
        dateError = '';
        $modalStore[0]?.response?.({
            periodStart,
            periodEnd,
            goalIds: selectedGoalIds,
            notes: notes.trim() || undefined,
        });
        modalStore.close();
    }

    function onCancel() {
        $modalStore[0]?.response?.(false);
        modalStore.close();
    }

    function goToGoals() {
        $modalStore[0]?.response?.(false);
        modalStore.close();
        goto('/app/profile');
    }
</script>

{#if $modalStore[0]}
    <div class="card p-6 w-full max-w-lg shadow-xl space-y-4">
        <h2 class="h3 font-bold">Generate weekly report</h2>

        <label class="label">
            <span>Week starting (Monday)</span>
            <input type="date" class="input" bind:value={periodStart} />
            <span class="text-xs opacity-70">Ends {periodEnd}</span>
        </label>
        {#if dateError}
            <p class="text-error-500 text-sm">{dateError}</p>
        {/if}

        <div>
            <p class="text-sm font-semibold mb-2">Goals to include</p>
            {#if goals.length === 0}
                <p class="text-sm opacity-70 italic">
                    No active running goals. The report will still generate, but coaching context will be limited.
                </p>
            {:else}
                <div class="flex flex-wrap gap-2">
                    {#each goals as goal (goal.id)}
                        <button
                            type="button"
                            class="chip"
                            class:variant-filled-primary={selectedGoalIds.includes(goal.id)}
                            class:variant-soft={!selectedGoalIds.includes(goal.id)}
                            on:click={() => toggleGoal(goal.id)}>
                            {GOAL_TYPE_LABELS[goal.goalType]}{goal.targetEventName ? ` — ${goal.targetEventName}` : ''}
                        </button>
                    {/each}
                </div>
            {/if}
            <div class="mt-2">
                <button type="button" class="btn btn-sm variant-soft" on:click={goToGoals}> Manage goals → </button>
            </div>
        </div>

        <label class="label">
            <span>Notes (optional)</span>
            <textarea
                class="textarea"
                rows="3"
                maxlength={REPORT_NOTES_MAX_LENGTH}
                bind:value={notes}
                placeholder="Anything contextual for the coach — deload week, travel, illness…"></textarea>
            <span class="text-xs opacity-60">{notes.length}/{REPORT_NOTES_MAX_LENGTH}</span>
        </label>

        <div class="flex justify-end gap-2 pt-2">
            <button type="button" class="btn variant-soft" on:click={onCancel}>Cancel</button>
            <button type="button" class="btn variant-filled-primary" on:click={onSubmit}>Generate</button>
        </div>
    </div>
{/if}
