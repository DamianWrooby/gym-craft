<script lang="ts">
    import { m } from '$lib/paraglide/messages.js';
    // A recut (stories 80–85): move the goal date or change the school. Only weeks not yet pulled are
    // re-laid; the cost is shown before confirm. A race a few days earlier is absorbed at once.
    import { invalidateAll } from '$app/navigation';
    import { recutPlan, type RecutAnswer } from '$lib/planner/adapt-client';
    import { SCHOOLS } from '$lib/planner/schools/catalogue';
    import type { SchoolId } from '$lib/planner/schools/types';

    export let userId: string;
    export let endDate: string;
    export let schoolId: SchoolId | null;
    export let open = false;

    let goalDate = endDate;
    let school: SchoolId | null = schoolId;
    // A recut moves the plan's own end and school: the form starts again from them.
    $: reset(endDate, schoolId);
    function reset(end: string, current: SchoolId | null) {
        goalDate = end;
        school = current;
    }
    let busy = false;
    let preview: RecutAnswer | null = null;
    let done: string | null = null;
    let error: string | null = null;

    $: change = {
        ...(goalDate !== endDate && { endDate: goalDate }),
        ...(school && school !== schoolId && { schoolId: school }),
    };
    $: changed = Object.keys(change).length > 0;
    // Any edit invalidates a preview: the athlete confirms only the cost they saw.
    $: if (change) preview = null;

    function openPanel() {
        open = true;
        done = null;
    }

    async function submit(confirm: boolean) {
        busy = true;
        error = null;
        const answer = await recutPlan(userId, change, confirm);
        busy = false;
        if ('error' in answer) {
            error = answer.error;
            return;
        }
        if (!answer.applied) {
            preview = answer;
            return;
        }
        done = answer.summary;
        preview = null;
        open = false;
        await invalidateAll();
    }
</script>

{#if done}
    <p class="text-sm text-emerald-300" role="status">{done}</p>
{/if}

{#if open}
    <section class="gc-panel p-4 space-y-3" aria-label={m.recut_aria()}>
        <p class="text-sm text-slate-300">
            {m.recut_intro()}
        </p>
        <label class="block text-sm">
            {m.recut_goal_date()}
            <input type="date" class="input mt-1" bind:value={goalDate} disabled={busy} />
        </label>
        <label class="block text-sm">
            {m.plan_training_school()}
            <select class="select mt-1" bind:value={school} disabled={busy}>
                {#each SCHOOLS as s (s.id)}
                    <option value={s.id}>{s.name}{s.id === schoolId ? ` (${m.recut_current()})` : ''}</option>
                {/each}
            </select>
        </label>

        {#if preview}
            <div class="text-sm text-amber-200 space-y-1" role="status">
                <p>{preview.summary}</p>
                {#each preview.losses as loss}<p class="text-slate-300">{loss}</p>{/each}
            </div>
            <button type="button" class="gc-button" disabled={busy} on:click={() => submit(true)}>
                {busy ? m.recut_relaying() : m.recut_confirm()}
            </button>
        {:else}
            <button type="button" class="gc-button" disabled={busy || !changed} on:click={() => submit(false)}>
                {busy ? m.recut_checking() : m.recut_preview()}
            </button>
        {/if}
        <button type="button" class="gc-ghost" disabled={busy} on:click={() => (open = false)}
            >{m.common_cancel()}</button>
        {#if error}<p class="text-sm text-rose-300" role="alert">{error}</p>{/if}
    </section>
{:else}
    <button type="button" class="gc-ghost" on:click={openPanel}>{m.recut_open()}</button>
{/if}
