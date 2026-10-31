<script lang="ts">
    import { m } from '$lib/paraglide/messages.js';
    import { getModalStore } from '@skeletonlabs/skeleton';
    import { goto } from '$app/navigation';
    import { REPORT_NOTES_MAX_LENGTH } from '@/constants/training-report.constants';
    import { goalTypeLabel } from '$lib/i18n/labels';
    import { addDays, isMonday, mondayOf, toIsoDate } from '$lib/utils/iso-week';
    import type { GoalType } from '@prisma/client';

    export let goals: Array<{
        id: string;
        goalType: GoalType;
        targetEventName: string | null;
        priority: number;
    }> = [];

    /** Pre-select a specific week (its Monday) — used when filling a gap from the load timeline. */
    export let initialPeriodStart: string | null = null;

    const modalStore = getModalStore();

    function defaultMonday(): string {
        // This week's Monday, then back 7 to last week's Monday (the default report period).
        return addDays(mondayOf(toIsoDate(new Date())), -7);
    }

    let periodStart = initialPeriodStart && isMonday(initialPeriodStart) ? initialPeriodStart : defaultMonday();
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
            dateError = m.report_modal_not_monday();
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
        <h2 class="h3 font-bold">{m.report_modal_heading()}</h2>

        <label class="label">
            <span>{m.report_modal_week_start()}</span>
            <input type="date" class="input" bind:value={periodStart} />
            <span class="text-xs opacity-70">Ends {periodEnd}</span>
        </label>
        {#if dateError}
            <p class="text-error-500 text-sm">{dateError}</p>
        {/if}

        <div>
            <p class="text-sm font-semibold mb-2">{m.report_modal_goals()}</p>
            {#if goals.length === 0}
                <p class="text-sm opacity-70 italic">
                    {m.report_modal_no_goals()}
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
                            {goalTypeLabel(goal.goalType)}{goal.targetEventName ? ` — ${goal.targetEventName}` : ''}
                        </button>
                    {/each}
                </div>
            {/if}
            <div class="mt-2">
                <button type="button" class="btn btn-sm variant-soft" on:click={goToGoals}
                    >{m.report_modal_manage_goals()}</button>
            </div>
        </div>

        <label class="label">
            <span>{m.report_modal_notes()}</span>
            <textarea
                class="textarea"
                rows="3"
                maxlength={REPORT_NOTES_MAX_LENGTH}
                bind:value={notes}
                placeholder={m.report_modal_notes_placeholder()}></textarea>
            <span class="text-xs opacity-60">{notes.length}/{REPORT_NOTES_MAX_LENGTH}</span>
        </label>

        <div class="flex justify-end gap-2 pt-2">
            <button type="button" class="btn variant-soft" on:click={onCancel}>{m.common_cancel()}</button>
            <button type="button" class="btn variant-filled-primary" on:click={onSubmit}
                >{m.report_modal_generate()}</button>
        </div>
    </div>
{/if}
