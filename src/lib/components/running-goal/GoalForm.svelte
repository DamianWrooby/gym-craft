<script lang="ts">
    import { m } from '$lib/paraglide/messages.js';
    // Race-first goal form (#421). Renders the rules in goal-form.ts and dispatches the API body.
    import { createEventDispatcher } from 'svelte';
    import { goalTypeLabel } from '$lib/i18n/labels';
    import {
        CUSTOM_KM,
        DISTANCES,
        NOTES_MAX,
        fromGoal,
        goalFormIssue,
        toGoalInput,
        type Focus,
        type GoalInput,
        type GoalRank,
        type RaceClass,
        type StoredGoal,
    } from '$lib/running-goal/goal-form';

    /** The goal to edit; null for a new one. */
    export let goal: StoredGoal | null = null;
    /** The athlete's other goals: they set the default class and where a new goal goes. */
    export let others: GoalRank[] = [];
    /** The athlete's local date (YYYY-MM-DD). */
    export let today: string;
    export let saving = false;

    const dispatch = createEventDispatcher<{ save: GoalInput; cancel: void }>();

    const FOCUSES: Focus[] = ['BASE_BUILDING', 'GENERAL_FITNESS', 'TEMPO_WORK', 'RECOVERY'];
    const CLASSES: { value: RaceClass; hint: string }[] = [
        { value: 'A', hint: m.goal_class_a_hint() },
        { value: 'B', hint: m.goal_class_b_hint() },
        { value: 'C', hint: m.goal_class_c_hint() },
    ];

    let form = fromGoal(goal, others);
    let detailsOpen = form.notes !== '';

    $: issue = goalFormIssue(form, today);

    function onSubmit(e: Event) {
        e.preventDefault();
        if (issue) return;
        dispatch('save', toGoalInput(form, others));
    }
</script>

<form class="space-y-4" on:submit={onSubmit}>
    <div class="grid grid-cols-2 gap-3" role="group" aria-label={m.goal_race_or_not()}>
        <button
            type="button"
            class="card p-4 text-left"
            class:variant-ghost-primary={form.isRace}
            aria-pressed={form.isRace}
            on:click={() => (form.isRace = true)}>
            <span class="font-bold block">{m.goal_type_race()}</span>
            <span class="text-sm opacity-70">{m.goal_race_hint()}</span>
        </button>
        <button
            type="button"
            class="card p-4 text-left"
            class:variant-ghost-primary={!form.isRace}
            aria-pressed={!form.isRace}
            on:click={() => (form.isRace = false)}>
            <span class="font-bold block">{m.goal_no_race()}</span>
            <span class="text-sm opacity-70">{m.goal_no_race_hint()}</span>
        </button>
    </div>

    {#if form.isRace}
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label class="label">
                <span>{m.goal_distance()}</span>
                <select class="select" bind:value={form.distance}>
                    {#each DISTANCES as d}
                        <option value={d.key}>{d.label}</option>
                    {/each}
                    <option value="custom">{m.goal_custom_distance()}</option>
                </select>
            </label>
            {#if form.distance === 'custom'}
                <label class="label">
                    <span>{m.goal_distance_km({ min: CUSTOM_KM.min, max: CUSTOM_KM.max })}</span>
                    <input type="text" class="input" inputmode="decimal" bind:value={form.customKm} />
                </label>
            {/if}
            <label class="label">
                <span>{m.goal_race_date()}</span>
                <input type="date" class="input" bind:value={form.date} />
            </label>
            <label class="label">
                <span>{m.goal_event_name()}</span>
                <input
                    type="text"
                    class="input"
                    maxlength="200"
                    bind:value={form.name}
                    placeholder={m.goal_event_name_placeholder()} />
            </label>
            <label class="label">
                <span>{m.goal_target_time()}</span>
                <input type="text" class="input" inputmode="numeric" bind:value={form.time} placeholder="1:45:00" />
            </label>
        </div>
        <fieldset class="space-y-2">
            <legend class="text-sm">{m.goal_race_class()}</legend>
            <div class="grid grid-cols-3 gap-2">
                {#each CLASSES as c}
                    <button
                        type="button"
                        class="card p-3 text-left"
                        class:variant-ghost-primary={form.raceClass === c.value}
                        aria-pressed={form.raceClass === c.value}
                        on:click={() => (form.raceClass = c.value)}>
                        <span class="font-bold block">{c.value}</span>
                        <span class="text-xs opacity-70">{c.hint}</span>
                    </button>
                {/each}
            </div>
        </fieldset>
    {:else}
        <label class="label">
            <span>{m.goal_focus()}</span>
            <select class="select" bind:value={form.focus}>
                {#each FOCUSES as f}
                    <option value={f}>{goalTypeLabel(f)}</option>
                {/each}
            </select>
        </label>
    {/if}

    <details bind:open={detailsOpen}>
        <summary class="cursor-pointer text-sm">{m.goal_more_details()}</summary>
        <label class="label mt-2">
            <span>{m.goal_notes()}</span>
            <textarea class="textarea" rows="2" maxlength={NOTES_MAX} bind:value={form.notes}></textarea>
        </label>
    </details>

    {#if issue}<p class="text-sm text-amber-300">{issue}</p>{/if}
    <div class="flex justify-end gap-2">
        <button type="button" class="btn variant-soft" on:click={() => dispatch('cancel')}>{m.common_cancel()}</button>
        <button type="submit" class="btn variant-filled-primary" disabled={saving || issue != null}>
            {saving ? m.common_saving() : m.goal_save()}
        </button>
    </div>
</form>
