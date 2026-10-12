<script lang="ts">
    import { goto, invalidateAll } from '$app/navigation';
    import { page } from '$app/stores';
    import PlannerShell from '$lib/components/planner/PlannerShell.svelte';
    import RunningGoalForm from '$lib/components/running-goal/RunningGoalForm.svelte';
    import { readApiError } from '$lib/utils/api-error';
    import { addDays } from '$lib/utils/iso-week';
    import { SCHOOLS, getSchool } from '$lib/planner/schools/catalogue';
    import { deriveAnchor } from '$lib/planner/core/anchor';
    import { recommendSchool } from '$lib/planner/core/recommend';
    import {
        choosablePhases,
        defaultCompression,
        horizonWeekCount,
        layoutHorizon,
        type RecentVolume,
    } from '$lib/planner/core/layout';
    import type { HrZoneBound, ZoneSource } from '$lib/planner/core/zones';
    import type { AnchorRun } from '$lib/planner/core/anchor';
    import {
        WEEKDAYS,
        WIZARD_STEPS,
        canFinish,
        initialWizardState,
        stepIssue,
        type WizardStep,
    } from '$lib/planner/wizard';

    type Goal = { id: string; goalType: string; name: string | null; date: string | null; distanceM: number | null };
    export let data:
        | { profileMissing: true }
        | {
              profileMissing: false;
              today: string;
              goals: Goal[];
              zoneProposal: { source: ZoneSource; zones: HrZoneBound[] } | null;
              recentVolume: RecentVolume;
              raceResults: { id: string; date: string; distanceM: number; timeSec: number }[];
              runs: AnchorRun[];
          };

    const STEP_TITLES: Record<WizardStep, string> = {
        goal: 'Choose your goal',
        school: 'Choose your training school',
        horizon: 'Set your horizon',
        zones: 'Confirm your heart-rate zones',
        results: 'Enter race results',
        availability: 'When can you train?',
    };
    const ZONE_SOURCE_LABEL: Record<ZoneSource, string> = {
        profile: 'From your profile (synced from Garmin or entered by you).',
        'max-hr': 'Proposed from your max heart rate.',
        age: 'Proposed from your age. This is a rough estimate: check it.',
    };
    const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const DISTANCES = [
        { label: '1500 m', m: 1500 },
        { label: '5 km', m: 5000 },
        { label: '10 km', m: 10000 },
        { label: 'Half marathon', m: 21097 },
        { label: 'Marathon', m: 42195 },
    ];

    let state = initialWizardState(data.profileMissing ? null : (data.zoneProposal?.zones ?? null));
    let stepIndex = 0;
    let submitting = false;
    let submitError: string | null = null;
    let addingGoal = false;
    let savingGoal = false;
    let goalError: string | null = null;
    let newResult = { date: '', distanceM: 5000, time: '' };
    let resultError: string | null = null;

    $: step = WIZARD_STEPS[stepIndex];
    $: ready = !data.profileMissing ? data : null;
    $: goal = ready?.goals.find((g) => g.id === state.goalId) ?? null;
    $: anchor = ready
        ? deriveAnchor({
              results: [...ready.raceResults, ...state.raceResults.map((r, i) => ({ ...r, id: `new-${i}` }))],
              runs: ready.runs,
              goalDistanceM: goal?.distanceM ?? null,
              today: ready.today,
          })
        : null;
    $: endDate = state.goalDate ?? state.endDate;
    $: weeks = ready && endDate && endDate > ready.today ? horizonWeekCount(ready.today, endDate) : null;
    $: recommendation = recommendSchool({
        goal: { isRace: !!goal?.date, distanceM: goal?.distanceM ?? null },
        // An undated goal has no horizon yet, so nothing is filtered at this step.
        horizonWeeks: weeks ?? 52,
        anchorPresent: anchor != null,
        recentMetresPerWeek: ready?.recentVolume.metresPerWeek ?? 0,
    });
    $: school = state.schoolId ? getSchool(state.schoolId) : null;
    $: runsPerWeek = WEEKDAYS.filter((d) => state.availability[d]).length;
    $: layout =
        ready && school && endDate
            ? layoutHorizon({
                  school,
                  startDate: ready.today,
                  endDate,
                  goal: { isRace: goal?.goalType === 'RACE' && !!goal?.date, distanceM: goal?.distanceM ?? null },
                  compression: state.compression ?? undefined,
                  recentVolume: ready.recentVolume,
                  runsPerWeek,
                  anchorPresent: anchor != null,
              })
            : null;
    // Layout refusal feeds the gating without writing back into `state` (no reactive cycle).
    $: gated = { ...state, layoutRefused: layout != null && !layout.ok };
    $: issue = stepIssue(step, gated);
    $: needsCompression = school && weeks != null && weeks < school.phases.reduce((n, p) => n + p.idealWeeks.value, 0);

    function chooseGoal(g: Goal) {
        state = { ...state, goalId: g.id, goalDate: g.date, endDate: null, compression: null };
    }

    async function addGoal(e: CustomEvent<Record<string, unknown>>) {
        savingGoal = true;
        goalError = null;
        const response = await fetch(`/api/user/${$page.data.user.id}/running-goals`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(e.detail),
        });
        if (!response.ok) {
            goalError = (await readApiError(response, 'The goal was not saved. Try again.')).message;
            savingGoal = false;
            return;
        }
        const { data: created } = (await response.json()) as { data: { id: string } };
        await invalidateAll();
        savingGoal = false;
        addingGoal = false;
        const fresh = ready?.goals.find((g) => g.id === created.id);
        if (fresh) chooseGoal(fresh);
    }

    function chooseSchool(id: (typeof SCHOOLS)[number]['id']) {
        const s = getSchool(id);
        const defaultEnd =
            state.goalDate || !ready
                ? state.endDate
                : addDays(ready.today, 7 * s.phases.reduce((n, p) => n + p.idealWeeks.value, 0));
        state = { ...state, schoolId: id, compression: null, endDate: defaultEnd };
    }

    function setPhaseWeeks(key: string, value: number) {
        if (!school || weeks == null) return;
        state = {
            ...state,
            compression: { ...(state.compression ?? defaultCompression(school, weeks)), [key]: value },
        };
    }

    function parseTime(text: string): number | null {
        const parts = text.trim().split(':').map(Number);
        if (parts.some((p) => !Number.isFinite(p) || p < 0) || parts.length < 2 || parts.length > 3) return null;
        return parts.reduce((total, p) => total * 60 + p, 0);
    }

    function addResult() {
        const timeSec = parseTime(newResult.time);
        if (!newResult.date || !ready || newResult.date > ready.today) {
            resultError = 'Enter a date that is not in the future.';
            return;
        }
        if (!timeSec) {
            resultError = 'Enter the time as mm:ss or h:mm:ss.';
            return;
        }
        state = {
            ...state,
            raceResults: [...state.raceResults, { date: newResult.date, distanceM: newResult.distanceM, timeSec }],
        };
        newResult = { date: '', distanceM: 5000, time: '' };
        resultError = null;
    }

    function updateZone(i: number, field: 'lowerBpm' | 'upperBpm', value: number) {
        if (!state.zones) return;
        const zones = state.zones.map((z, j) => (j === i ? { ...z, [field]: value } : z));
        state = { ...state, zones, zonesConfirmed: false };
    }

    function formatTime(sec: number) {
        const h = Math.floor(sec / 3600);
        const m = Math.floor((sec % 3600) / 60);
        const s = String(sec % 60).padStart(2, '0');
        return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
    }

    async function finish() {
        if (!canFinish(gated) || submitting) return;
        submitting = true;
        submitError = null;
        const response = await fetch(`/api/user/${$page.data.user.id}/plan`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                goalId: state.goalId,
                schoolId: state.schoolId,
                endDate: state.goalDate ? null : state.endDate,
                compression: state.compression,
                hrZoneBounds: state.zones,
                raceResults: state.raceResults,
                availability: state.availability,
                longRunDay: state.longRunDay,
            }),
        });
        if (response.ok) {
            await goto('/app/plan');
            return;
        }
        submitError = (await readApiError(response, 'Setup failed. Try again.')).message;
        submitting = false;
    }
</script>

<svelte:head><title>Plan setup | GymCraft</title></svelte:head>

<PlannerShell fullscreen>
    {#if data.profileMissing}
        <section class="gc-panel p-8 space-y-4 text-center">
            <h1 class="text-2xl font-black">Your athlete profile comes first</h1>
            <p class="text-slate-300">The planner needs your age and heart-rate details.</p>
            <a class="gc-button inline-block" href="/app/profile">Open profile</a>
        </section>
    {:else}
        <ol class="flex gap-1" aria-label="Setup progress">
            {#each WIZARD_STEPS as s, i}
                <li
                    class="h-1.5 flex-1 {i < stepIndex
                        ? 'bg-rose-600'
                        : i === stepIndex
                          ? 'bg-sky-400'
                          : 'bg-slate-700'}"
                    aria-current={i === stepIndex ? 'step' : undefined}>
                    <span class="sr-only">{STEP_TITLES[s]}</span>
                </li>
            {/each}
        </ol>
        <div class="text-[11px] uppercase tracking-[0.3em] text-rose-400">
            Step {stepIndex + 1} of {WIZARD_STEPS.length}
        </div>
        <h1 class="text-3xl font-black tracking-wide">{STEP_TITLES[step]}</h1>

        {#if step === 'goal'}
            {#if data.goals.length === 0 && !addingGoal}
                <p class="text-slate-400">You have no goals yet. Add one to start your plan.</p>
            {/if}
            <div class="grid gap-3 sm:grid-cols-2">
                {#each data.goals as g}
                    <button
                        type="button"
                        class="gc-panel p-4 text-left {state.goalId === g.id ? 'ring-2 ring-sky-400' : ''}"
                        on:click={() => chooseGoal(g)}>
                        <div class="font-bold text-lg">{g.name ?? g.goalType.replace('_', ' ').toLowerCase()}</div>
                        <div class="text-sm text-slate-400">
                            {g.date ? `Race day ${g.date}` : 'No date: you choose the horizon'}
                            {g.distanceM ? ` · ${(g.distanceM / 1000).toFixed(1)} km` : ''}
                        </div>
                    </button>
                {/each}
            </div>
            {#if addingGoal}
                <section class="gc-panel p-5 space-y-3">
                    <h2 class="font-bold">New goal</h2>
                    <RunningGoalForm
                        saving={savingGoal}
                        on:save={addGoal}
                        on:cancel={() => ((addingGoal = false), (goalError = null))} />
                    {#if goalError}<p class="text-rose-400 text-sm">{goalError}</p>{/if}
                </section>
            {:else}
                <button type="button" class="gc-ghost" on:click={() => (addingGoal = true)}>+ Add a goal</button>
            {/if}
        {:else if step === 'school'}
            <div class="grid gap-3 sm:grid-cols-2">
                {#each SCHOOLS as s}
                    {@const filtered = recommendation.filtered.find((f) => f.schoolId === s.id)}
                    {@const recommended = recommendation.recommended?.schoolId === s.id}
                    <button
                        type="button"
                        disabled={!!filtered}
                        class="gc-panel p-5 text-left space-y-2 disabled:opacity-40 {state.schoolId === s.id
                            ? 'ring-2 ring-sky-400'
                            : ''}"
                        on:click={() => chooseSchool(s.id)}>
                        {#if recommended}
                            <div class="text-[11px] uppercase tracking-[0.25em] text-sky-300">
                                ★ Recommended · {recommendation.recommended?.reason}
                            </div>
                        {/if}
                        <div class="text-xl font-black">{s.name}</div>
                        <div class="text-sm text-rose-300">{s.tagline}</div>
                        <p class="text-sm text-slate-300">{s.lore}</p>
                        {#if filtered}<p class="text-sm text-amber-300">Not available: {filtered.reason}</p>{/if}
                    </button>
                {/each}
            </div>
        {:else if step === 'horizon'}
            <section class="gc-panel p-5 space-y-4">
                {#if state.goalDate}
                    <p>Your horizon ends on race day: <b>{state.goalDate}</b>.</p>
                {:else}
                    <label class="block space-y-1">
                        <span class="text-sm text-slate-300">
                            Horizon end ({school?.name} default: {school?.phases.reduce(
                                (n, p) => n + p.idealWeeks.value,
                                0,
                            )} weeks)
                        </span>
                        <input type="date" min={data.today} bind:value={state.endDate} />
                    </label>
                {/if}
                {#if weeks}<p class="text-sm text-slate-400">{weeks} plan weeks from today.</p>{/if}

                {#if school && weeks != null && needsCompression}
                    <div class="space-y-2">
                        <h2 class="font-bold">Your horizon is shorter than {school.name}'s full structure</h2>
                        <p class="text-sm text-slate-400">Choose which phases are shortened or dropped.</p>
                        {#each choosablePhases(school) as p}
                            {@const value = (state.compression ?? defaultCompression(school, weeks))[p.key]}
                            <div class="flex flex-wrap items-center gap-3">
                                <span class="w-44">{p.name}</span>
                                <input
                                    type="number"
                                    class="w-20"
                                    min={p.floorWeeks.value}
                                    max={p.idealWeeks.value}
                                    disabled={value === 0}
                                    {value}
                                    on:change={(e) => setPhaseWeeks(p.key, Number(e.currentTarget.value))} />
                                <span class="text-xs text-slate-500"
                                    >{p.floorWeeks.value}–{p.idealWeeks.value} weeks</span>
                                {#if p.droppable.value}
                                    <label class="text-sm flex items-center gap-1">
                                        <input
                                            type="checkbox"
                                            checked={value === 0}
                                            on:change={(e) =>
                                                setPhaseWeeks(
                                                    p.key,
                                                    e.currentTarget.checked ? 0 : p.floorWeeks.value,
                                                )} />
                                        Drop
                                    </label>
                                {/if}
                            </div>
                        {/each}
                    </div>
                {/if}

                {#if layout && !layout.ok}
                    <p class="text-amber-300">{layout.reason}</p>
                {:else if layout?.ok}
                    {#each layout.layout.losses as loss}<p class="text-sm text-amber-300">⚠ {loss}</p>{/each}
                    <ol class="space-y-1">
                        {#each layout.layout.phases as p}
                            <li class="flex justify-between border-b border-slate-700 py-1">
                                <span>
                                    {p.name}
                                    {#if p.source === 'LEAD_IN'}
                                        <span class="text-xs text-slate-400">· {p.intent}</span>
                                    {/if}
                                </span>
                                <span class="text-slate-400">{p.weekCount} wk</span>
                            </li>
                        {/each}
                    </ol>
                    {#if layout.layout.timeTrial}
                        <p class="text-sm text-sky-300">
                            No race result yet: a {layout.layout.timeTrial.distanceM / 1000} km time trial is scheduled in
                            week {layout.layout.timeTrial.weekIndex + 1}.
                        </p>
                    {/if}
                {/if}
            </section>
        {:else if step === 'zones'}
            <section class="gc-panel p-5 space-y-3">
                {#if data.zoneProposal}
                    <p class="text-sm text-slate-300">{ZONE_SOURCE_LABEL[data.zoneProposal.source]}</p>
                {:else}
                    <p class="text-sm text-amber-300">
                        Enter your zones. Add your max heart rate on your profile for a proposal.
                    </p>
                {/if}
                {#each state.zones ?? [] as z, i}
                    <div class="flex items-center gap-3">
                        <span class="w-16 font-bold">Zone {z.zone}</span>
                        <input
                            type="number"
                            class="w-20"
                            value={z.lowerBpm}
                            aria-label="Zone {z.zone} lower bpm"
                            on:change={(e) => updateZone(i, 'lowerBpm', Number(e.currentTarget.value))} />
                        <span>–</span>
                        <input
                            type="number"
                            class="w-20"
                            value={z.upperBpm}
                            aria-label="Zone {z.zone} upper bpm"
                            on:change={(e) => updateZone(i, 'upperBpm', Number(e.currentTarget.value))} />
                        <span class="text-slate-400 text-sm">bpm</span>
                    </div>
                {/each}
                <label class="flex items-center gap-2 pt-2">
                    <input type="checkbox" bind:checked={state.zonesConfirmed} />
                    These are my heart-rate zones.
                </label>
            </section>
        {:else if step === 'results'}
            <section class="gc-panel p-5 space-y-3">
                <p class="text-sm text-slate-300">
                    A race, a parkrun or a solo time trial from 1500 m to the marathon. Your paces come from these. Skip
                    this step and GymCraft schedules a time trial.
                </p>
                <ul class="space-y-1">
                    {#each data.raceResults as r}
                        <li class="text-sm text-slate-400">
                            {r.date} · {r.distanceM / 1000} km · {formatTime(r.timeSec)} (saved)
                        </li>
                    {/each}
                    {#each state.raceResults as r, i}
                        <li class="text-sm flex gap-3">
                            {r.date} · {r.distanceM / 1000} km · {formatTime(r.timeSec)}
                            <button
                                type="button"
                                class="text-rose-400"
                                on:click={() =>
                                    (state = { ...state, raceResults: state.raceResults.filter((_, j) => j !== i) })}
                                >Remove</button>
                        </li>
                    {/each}
                </ul>
                <div class="flex flex-wrap gap-2 items-end">
                    <input type="date" max={data.today} bind:value={newResult.date} aria-label="Result date" />
                    <select bind:value={newResult.distanceM} aria-label="Distance">
                        {#each DISTANCES as d}<option value={d.m}>{d.label}</option>{/each}
                    </select>
                    <input placeholder="mm:ss" class="w-28" bind:value={newResult.time} aria-label="Time" />
                    <button type="button" class="gc-ghost" on:click={addResult}>Add</button>
                </div>
                {#if resultError}<p class="text-sm text-amber-300">{resultError}</p>{/if}
                <p class="text-sm text-sky-300">
                    {anchor
                        ? `Paces anchor on your ${anchor.distanceM / 1000} km${anchor.stale ? ' (stale: enter a newer result)' : ''}.`
                        : 'No anchor yet: a time trial will be scheduled.'}
                </p>
            </section>
        {:else if step === 'availability'}
            <section class="gc-panel p-5 space-y-4">
                <div class="flex flex-wrap gap-2">
                    {#each WEEKDAYS as d, i}
                        <label
                            class="px-3 py-2 border cursor-pointer {state.availability[d]
                                ? 'border-sky-400 text-sky-200'
                                : 'border-slate-600 text-slate-500'}">
                            <input type="checkbox" class="sr-only" bind:checked={state.availability[d]} />
                            {DAY_LABELS[i]}
                        </label>
                    {/each}
                </div>
                <label class="flex items-center gap-3">
                    Long-run day
                    <select bind:value={state.longRunDay}>
                        {#each DAY_LABELS as label, i}<option value={i}>{label}</option>{/each}
                    </select>
                </label>
            </section>
        {/if}

        {#if issue}<p class="text-sm text-amber-300" role="status">{issue}</p>{/if}
        {#if submitError}<p class="text-sm text-red-400" role="alert">{submitError}</p>{/if}

        <div class="flex justify-between pt-2">
            <button type="button" class="gc-ghost" disabled={stepIndex === 0} on:click={() => stepIndex--}>Back</button>
            {#if stepIndex < WIZARD_STEPS.length - 1}
                <button type="button" class="gc-button" disabled={!!issue} on:click={() => stepIndex++}>Next</button>
            {:else}
                <button type="button" class="gc-button" disabled={!canFinish(gated) || submitting} on:click={finish}>
                    {submitting ? 'Laying out…' : 'Lay out my plan'}
                </button>
            {/if}
        </div>
    {/if}
</PlannerShell>
