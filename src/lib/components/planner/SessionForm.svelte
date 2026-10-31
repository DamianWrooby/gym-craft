<script lang="ts">
    import { m } from '$lib/paraglide/messages.js';
    import { otherEffortLabel, otherModalityLabel } from '$lib/i18n/labels';
    // One form for adding and editing (story 33): kind is a field, and the server costs the session
    // before it is kept. Editing an AI session makes it the athlete's own (story 35).
    import { createEventDispatcher } from 'svelte';
    import { invalidateAll } from '$app/navigation';
    import { addDays } from '$lib/utils/iso-week';
    import { addSession, editSession } from '$lib/planner/session-client';
    import {
        OTHER_EFFORTS,
        OTHER_MODALITIES,
        isRepeat,
        type RunBlock,
        type SessionKind,
    } from '$lib/planner/core/session';
    import type { SchoolDefinition } from '$lib/planner/schools/types';
    import type { PlanViewSession, PlanViewWeek } from '$lib/planner/plan-view';

    export let userId: string;
    export let week: Pick<PlanViewWeek, 'startDate' | 'endDate'>;
    export let school: SchoolDefinition | null;
    /** Absent when adding. */
    export let session: PlanViewSession | null = null;

    const dispatch = createEventDispatcher<{ close: void }>();
    const body = session?.body as Record<string, unknown> | undefined;

    let kind: SessionKind = session?.kind ?? 'OTHER';
    let date = session?.scheduledDate ?? week.startDate;
    let title = (body?.title as string) ?? '';
    let durationMin = (body?.durationMin as number) ?? 45;
    let modality = (body?.modality as string) ?? 'ride';
    let effort = (body?.effort as string) ?? 'easy';
    let label = school?.intensityLabels[0]?.key ?? '';
    let template = (body?.template as string) ?? school?.strengthTemplates[0]?.key ?? '';
    let exercise = { name: '', sets: 3, reps: '8', load: '' };
    // Editing a run keeps its structure and lets each step's length change, in minutes or metres.
    let steps: RunBlock[] = structuredClone((body?.steps as RunBlock[]) ?? []);

    let saving = false;
    let error: string | null = null;

    const dates = Array.from({ length: 7 }, (_, i) => addDays(week.startDate, i));
    const labelName = (key: string) => school?.intensityLabels.find((l) => l.key === key)?.name ?? key;

    function payload(): Record<string, unknown> {
        if (kind === 'OTHER') return { kind, date, title, modality, durationMin, effort };
        if (kind === 'STRENGTH') {
            const exercises = session ? body?.exercises : [exercise];
            return { kind, date, title, template, durationMin, exercises };
        }
        const runSteps = session ? steps : [{ label, durationSec: durationMin * 60 }];
        return {
            kind,
            date,
            title,
            keySession: body?.keySession ?? null,
            cutKey: body?.cutKey ?? null,
            steps: runSteps,
        };
    }

    async function save() {
        saving = true;
        error = null;
        const result = session ? await editSession(userId, session.id, payload()) : await addSession(userId, payload());
        saving = false;
        if ('error' in result) {
            error = result.error;
            return;
        }
        await invalidateAll();
        dispatch('close');
    }
</script>

<form class="gc-session-form space-y-2 text-sm" on:submit|preventDefault={save}>
    <div class="flex flex-wrap gap-2">
        <label class="space-y-1">
            <span class="block text-slate-400">{m.form_kind()}</span>
            <select bind:value={kind} disabled={session != null}>
                <option value="RUNNING">{m.form_kind_run()}</option>
                <option value="STRENGTH">{m.form_kind_strength()}</option>
                <option value="OTHER">{m.form_kind_other()}</option>
            </select>
        </label>
        <label class="space-y-1">
            <span class="block text-slate-400">{m.form_day()}</span>
            <select bind:value={date}>
                {#each dates as d}<option value={d}>{d}</option>{/each}
            </select>
        </label>
        <label class="space-y-1 grow">
            <span class="block text-slate-400">{m.form_title()}</span>
            <input class="w-full" type="text" maxlength="120" bind:value={title} />
        </label>
    </div>

    {#if kind === 'OTHER'}
        <div class="flex flex-wrap gap-2">
            <label class="space-y-1">
                <span class="block text-slate-400">{m.form_activity()}</span>
                <select bind:value={modality}>
                    {#each OTHER_MODALITIES as mod}<option value={mod}>{otherModalityLabel(mod)}</option>{/each}
                </select>
            </label>
            <label class="space-y-1">
                <span class="block text-slate-400">{m.common_minutes()}</span>
                <input class="w-20" type="number" min="1" max="1440" bind:value={durationMin} />
            </label>
            <label class="space-y-1">
                <span class="block text-slate-400">{m.form_effort()}</span>
                <select bind:value={effort}>
                    {#each OTHER_EFFORTS as e}<option value={e}>{otherEffortLabel(e)}</option>{/each}
                </select>
            </label>
        </div>
    {:else if kind === 'STRENGTH'}
        <div class="flex flex-wrap gap-2">
            <label class="space-y-1">
                <span class="block text-slate-400">{m.form_template()}</span>
                <select bind:value={template}>
                    {#each school?.strengthTemplates ?? [] as t}<option value={t.key}>{t.name}</option>{/each}
                </select>
            </label>
            <label class="space-y-1">
                <span class="block text-slate-400">{m.common_minutes()}</span>
                <input class="w-20" type="number" min="1" bind:value={durationMin} />
            </label>
        </div>
        {#if !session}
            <div class="flex flex-wrap gap-2">
                <input
                    type="text"
                    placeholder={m.form_exercise()}
                    aria-label={m.form_exercise()}
                    bind:value={exercise.name} />
                <input class="w-16" type="number" min="1" aria-label={m.form_sets()} bind:value={exercise.sets} />
                <input class="w-16" type="text" aria-label={m.form_reps()} bind:value={exercise.reps} />
                <input
                    class="w-24"
                    type="text"
                    placeholder={m.form_load()}
                    aria-label={m.form_load()}
                    bind:value={exercise.load} />
            </div>
        {/if}
    {:else if session}
        <ul class="space-y-1">
            {#each steps as block}
                {#each isRepeat(block) ? block.steps : [block] as step}
                    <li class="flex items-center gap-2 {isRepeat(block) ? 'pl-4' : ''}">
                        <span class="w-40 text-slate-300">
                            {isRepeat(block) ? `${block.repeat} × ` : ''}{labelName(step.label)}
                        </span>
                        {#if step.durationSec != null}
                            <input
                                class="w-20"
                                type="number"
                                min="1"
                                aria-label={m.common_minutes()}
                                value={Math.round(step.durationSec / 60)}
                                on:input={(e) => (step.durationSec = Number(e.currentTarget.value) * 60)} />
                            <span class="text-slate-500">min</span>
                        {:else}
                            <input
                                class="w-24"
                                type="number"
                                min="1"
                                aria-label={m.form_metres()}
                                value={step.distanceM}
                                on:input={(e) => (step.distanceM = Number(e.currentTarget.value))} />
                            <span class="text-slate-500">m</span>
                        {/if}
                    </li>
                {/each}
            {/each}
        </ul>
    {:else}
        <div class="flex flex-wrap gap-2">
            <label class="space-y-1">
                <span class="block text-slate-400">{m.form_intensity()}</span>
                <select bind:value={label}>
                    {#each school?.intensityLabels ?? [] as l}<option value={l.key}>{l.name}</option>{/each}
                </select>
            </label>
            <label class="space-y-1">
                <span class="block text-slate-400">{m.common_minutes()}</span>
                <input class="w-20" type="number" min="1" bind:value={durationMin} />
            </label>
        </div>
    {/if}

    {#if error}<p class="text-red-400" role="alert">{error}</p>{/if}
    <div class="flex gap-2">
        <button type="submit" class="gc-button" disabled={saving}
            >{session ? m.form_save_edit() : m.form_add_session()}</button>
        <button type="button" class="gc-ghost" on:click={() => dispatch('close')}>{m.common_cancel()}</button>
    </div>
</form>
