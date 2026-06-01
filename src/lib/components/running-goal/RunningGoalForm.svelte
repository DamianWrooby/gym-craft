<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import { GOAL_TYPE_LABELS } from '@/constants/training-report.constants';
    import type { GoalType } from '@prisma/client';

    export let goal: {
        id?: string;
        goalType?: GoalType;
        targetEventName?: string | null;
        targetEventDate?: string | null;
        targetDistanceM?: number | null;
        targetTimeSec?: number | null;
        priority?: number;
        notes?: string | null;
    } = {};
    export let saving = false;

    const dispatch = createEventDispatcher<{
        save: typeof formValues;
        cancel: void;
    }>();

    let goalType: GoalType = goal.goalType ?? 'RACE';
    let targetEventName = goal.targetEventName ?? '';
    let targetEventDate = goal.targetEventDate ?? '';
    let targetDistanceM: number | null = goal.targetDistanceM ?? null;
    let targetTimeSec: number | null = goal.targetTimeSec ?? null;
    let priority: number = goal.priority ?? 1;
    let notes = goal.notes ?? '';

    $: formValues = {
        goalType,
        targetEventName: targetEventName.trim() || null,
        targetEventDate: targetEventDate || null,
        targetDistanceM: targetDistanceM ?? null,
        targetTimeSec: targetTimeSec ?? null,
        priority,
        notes: notes.trim() || null,
    };

    function onSubmit(e: Event) {
        e.preventDefault();
        dispatch('save', formValues);
    }
</script>

<form class="space-y-3" on:submit={onSubmit}>
    <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
        <label class="label">
            <span>Goal type</span>
            <select class="select" bind:value={goalType}>
                {#each Object.entries(GOAL_TYPE_LABELS) as [key, label]}
                    <option value={key}>{label}</option>
                {/each}
            </select>
        </label>
        <label class="label">
            <span>Priority</span>
            <input type="number" class="input" min="1" max="10" bind:value={priority} />
        </label>
        <label class="label">
            <span>Event name</span>
            <input type="text" class="input" bind:value={targetEventName} placeholder="Berlin Marathon" />
        </label>
        <label class="label">
            <span>Event date</span>
            <input type="date" class="input" bind:value={targetEventDate} />
        </label>
        <label class="label">
            <span>Target distance (m)</span>
            <input type="number" class="input" min="0" step="1" bind:value={targetDistanceM} />
        </label>
        <label class="label">
            <span>Target time (sec)</span>
            <input type="number" class="input" min="0" step="1" bind:value={targetTimeSec} />
        </label>
        <label class="label md:col-span-2">
            <span>Notes</span>
            <textarea class="textarea" rows="2" maxlength="500" bind:value={notes}></textarea>
        </label>
    </div>
    <div class="flex justify-end gap-2">
        <button type="button" class="btn variant-soft" on:click={() => dispatch('cancel')}>Cancel</button>
        <button type="submit" class="btn variant-filled-primary" disabled={saving}>
            {saving ? 'Saving…' : 'Save goal'}
        </button>
    </div>
</form>
