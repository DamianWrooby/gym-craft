<script lang="ts">
    import { invalidateAll } from '$app/navigation';
    import { getModalStore } from '@skeletonlabs/skeleton';
    import SportIcon from '$lib/components/sport-icon/SportIcon.svelte';
    import SessionForm from './SessionForm.svelte';
    import { stepLines } from '$lib/planner/session-format';
    import { markSession, recordTimeTrial } from '$lib/planner/session-client';
    import { uploadWorkoutToGarmin } from '$lib/garmin/upload-workout';
    import { withGarminLogin } from '$lib/garmin/garmin-login';
    import { askGarminCredentials } from '$lib/garmin/garmin-login-modal';
    import type { SchoolDefinition } from '$lib/planner/schools/types';
    import type { PlanViewSession, PlanViewWeek } from '$lib/planner/plan-view';

    export let session: PlanViewSession;
    export let schoolId: string | null;
    /** Set where the athlete can act on the session; read-only views leave it out. */
    export let actions: { userId: string; week: PlanViewWeek; school: SchoolDefinition | null } | null = null;

    $: body = session.body;
    $: running = 'steps' in body ? body : null;
    $: strength = 'exercises' in body ? body : null;
    $: other = !running && !strength && 'effort' in body ? body : null;
    $: timeTrialM = session.kind === 'RUNNING' ? (actions?.week.timeTrialDistanceM ?? null) : null;

    const modalStore = actions ? getModalStore() : null;

    let editing = false;
    let busy = false;
    let message: string | null = null;
    let ttMinutes: number | null = null;
    let ttSeconds: number | null = null;

    async function run(action: () => Promise<{ ok: true } | { error: string }>) {
        busy = true;
        message = null;
        const result = await action();
        busy = false;
        if ('error' in result) message = result.error;
        else await invalidateAll();
    }

    const mark = (status: 'DONE' | 'SKIPPED' | 'PLANNED') =>
        run(() => markSession(actions!.userId, session.id, status));

    function saveTimeTrial() {
        const timeSec = Math.round((ttMinutes ?? 0) * 60 + (ttSeconds ?? 0));
        run(() => recordTimeTrial(actions!.userId, session.id, timeSec));
    }

    async function sendToGarmin() {
        busy = true;
        message = null;
        const result = await withGarminLogin(
            actions!.userId,
            () => uploadWorkoutToGarmin(actions!.userId, session.id),
            () =>
                askGarminCredentials(modalStore!, {
                    body: 'Sign in to Garmin Connect to send this session to your watch.',
                }),
        );
        busy = false;
        if (result.ok) message = 'Sent to Garmin Connect.';
        else if (result.code !== 'LOGIN_CANCELLED')
            message = 'message' in result ? String(result.message) : 'Could not send to Garmin.';
    }
</script>

<article class="gc-session" data-kind={session.kind} data-status={session.status} aria-label={body.title}>
    <header class="flex items-start gap-2">
        <span class="mt-0.5 {session.kind === 'STRENGTH' ? 'text-rose-400' : 'text-sky-300'}" title={session.kind}>
            {#if session.kind === 'OTHER'}
                <span aria-hidden="true">◇</span>
            {:else}
                <SportIcon sport={session.kind === 'STRENGTH' ? 'gym' : 'running'} size={18} />
            {/if}
            <span class="sr-only">{session.kind.toLowerCase()}</span>
        </span>
        <div class="min-w-0">
            <h4 class="font-semibold text-slate-100 leading-tight">{body.title}</h4>
            {#if session.status === 'DONE'}
                <p class="text-xs text-emerald-400">✓ Done</p>
            {:else if session.status === 'SKIPPED'}
                <p class="text-xs text-slate-500">Skipped</p>
            {/if}
            {#if running?.keySession}
                <p class="text-xs text-amber-300">★ {running.reason}</p>
            {/if}
        </div>
    </header>

    {#if running}
        {#if session.staleAnchor}
            <p class="text-xs text-amber-300" role="note">These paces rest on an old result. Enter a newer one.</p>
        {/if}
        <ul class="mt-1 space-y-0.5 text-sm text-slate-300">
            {#each stepLines(running.steps, schoolId) as line}
                <li class={line.nested ? 'pl-4 border-l border-slate-700' : ''}>
                    {line.text}{#if line.note}<span class="text-slate-500"> · {line.note}</span>{/if}
                </li>
            {/each}
        </ul>
    {:else if strength}
        <p class="text-xs text-slate-400">{strength.durationMin} min{strength.heavy ? ' · heavy' : ''}</p>
        <ul class="mt-1 space-y-0.5 text-sm text-slate-300">
            {#each strength.exercises as e}
                <li>{e.name}: {e.sets} × {e.reps}{e.load ? ` @ ${e.load}` : ''}</li>
            {/each}
        </ul>
    {:else if other}
        <p class="text-sm text-slate-300">
            {other.modality ? `${other.modality}, ` : ''}{other.durationMin} min, {other.effort}
        </p>
    {/if}

    {#if actions}
        {#if editing}
            <SessionForm
                userId={actions.userId}
                week={actions.week}
                school={actions.school}
                {session}
                on:close={() => (editing = false)} />
        {:else}
            <div class="mt-2 flex flex-wrap gap-1 text-xs">
                {#if session.status === 'PLANNED'}
                    <button type="button" class="gc-ghost" disabled={busy} on:click={() => mark('DONE')}>Done</button>
                    <button type="button" class="gc-ghost" disabled={busy} on:click={() => mark('SKIPPED')}
                        >Skip</button>
                    <button type="button" class="gc-ghost" disabled={busy} on:click={() => (editing = true)}
                        >Edit</button>
                {:else}
                    <button type="button" class="gc-ghost" disabled={busy} on:click={() => mark('PLANNED')}
                        >Reopen</button>
                {/if}
                {#if session.kind !== 'OTHER'}
                    <button type="button" class="gc-ghost" disabled={busy} on:click={sendToGarmin}
                        >Send to Garmin</button>
                {/if}
            </div>
            {#if timeTrialM && session.status === 'PLANNED'}
                <form class="mt-2 flex flex-wrap items-center gap-1 text-xs" on:submit|preventDefault={saveTimeTrial}>
                    <span class="text-sky-300">⏱ {timeTrialM / 1000} km result:</span>
                    <input
                        class="w-14"
                        type="number"
                        min="0"
                        placeholder="min"
                        aria-label="Minutes"
                        bind:value={ttMinutes} />
                    <input
                        class="w-14"
                        type="number"
                        min="0"
                        max="59"
                        placeholder="s"
                        aria-label="Seconds"
                        bind:value={ttSeconds} />
                    <button type="submit" class="gc-ghost" disabled={busy || !ttMinutes}>Save result</button>
                </form>
            {/if}
        {/if}
        {#if message}<p class="mt-1 text-xs text-slate-300" role="status">{message}</p>{/if}
    {/if}
</article>

<style>
    .gc-session {
        background: rgba(2, 6, 23, 0.6);
        border: 1px solid rgba(148, 163, 184, 0.2);
        padding: 0.5rem 0.75rem;
    }
    .gc-session[data-status='SKIPPED'] {
        opacity: 0.55;
    }
    .gc-session[data-kind='STRENGTH'] {
        border-left: 2px solid #e11d48;
    }
    .gc-session[data-kind='RUNNING'] {
        border-left: 2px solid #38bdf8;
    }
</style>
