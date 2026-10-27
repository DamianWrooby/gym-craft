<script lang="ts">
    import { m } from '$lib/paraglide/messages.js';
    import InfoTooltip from '$lib/components/info-tooltip/InfoTooltip.svelte';
    import { otherEffortLabel, otherModalityLabel } from '$lib/i18n/labels';
    import { invalidateAll } from '$app/navigation';
    import { getModalStore } from '@skeletonlabs/skeleton';
    import SportIcon from '$lib/components/sport-icon/SportIcon.svelte';
    import SessionForm from './SessionForm.svelte';
    import {
        CheckIcon,
        Edit2Icon,
        LinkIcon,
        RotateCcwIcon,
        SaveIcon,
        SkipForwardIcon,
        SlashIcon,
        UploadCloudIcon,
    } from 'svelte-feather-icons';
    import { stepLines } from '$lib/planner/session-format';
    import { linkSession, markSession, recordTimeTrial, unlinkSession } from '$lib/planner/session-client';
    import { uploadWorkoutToGarmin } from '$lib/garmin/upload-workout';
    import { withGarminLogin } from '$lib/garmin/garmin-login';
    import { askGarminCredentials } from '$lib/garmin/garmin-login-modal';
    import type { SchoolDefinition } from '$lib/planner/schools/types';
    import type { PlanViewActivity, PlanViewSession, PlanViewWeek } from '$lib/planner/plan-view';

    export let session: PlanViewSession;
    export let schoolId: string | null;
    /** Set where the athlete can act on the session; read-only views leave it out. */
    export let actions: {
        userId: string;
        week: PlanViewWeek;
        school: SchoolDefinition | null;
        /** Set in the current week only: links are fixed once the week is over. */
        activities: PlanViewActivity[] | null;
    } | null = null;

    $: body = session.body;
    $: running = 'steps' in body ? body : null;
    $: strength = 'exercises' in body ? body : null;
    $: other = !running && !strength && 'effort' in body ? body : null;
    $: linked = session.activityId ? actions?.activities?.find((a) => a.id === session.activityId) : null;
    $: candidates = session.activityId
        ? []
        : (actions?.activities ?? []).filter((a) => a.kind === session.kind && !a.linkedSessionId);
    let chosen = '';
    $: chosenActivity = candidates.find((a) => a.id === chosen);
    const activityLabel = (a: PlanViewActivity) =>
        `${a.date.slice(5)} · ${a.name} · ${Math.round(a.durationSec / 60)} min`;
    $: timeTrialM = session.kind === 'RUNNING' ? (actions?.week.timeTrialDistanceM ?? null) : null;

    const modalStore = actions ? getModalStore() : null;

    let editing = false;
    let busy = false;
    /** True while the workout uploads; the button spins and the card says so. */
    let sending = false;
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

    /**
     * Shows the expected session state at once, then sends the request. The page reload after a
     * success replaces the prop with the server's state; a failure puts the old state back.
     */
    async function runOptimistic(
        expected: Partial<PlanViewSession>,
        action: () => Promise<{ ok: true } | { error: string }>,
    ) {
        const previous = session;
        session = { ...session, notConfirmed: false, ...expected };
        message = null;
        const result = await action();
        if ('error' in result) {
            session = previous;
            message = result.error;
        } else await invalidateAll();
    }

    const mark = (status: 'DONE' | 'SKIPPED' | 'PLANNED') =>
        runOptimistic({ status }, () => markSession(actions!.userId, session.id, status));

    const link = () => {
        const activityId = chosen;
        chosen = '';
        return runOptimistic({ status: 'DONE', activityId }, () =>
            linkSession(actions!.userId, session.id, activityId),
        );
    };
    const unlink = () =>
        runOptimistic({ status: 'PLANNED', activityId: null }, () => unlinkSession(actions!.userId, session.id));

    function saveTimeTrial() {
        const timeSec = Math.round((ttMinutes ?? 0) * 60 + (ttSeconds ?? 0));
        run(() => recordTimeTrial(actions!.userId, session.id, timeSec));
    }

    async function sendToGarmin() {
        busy = true;
        sending = true;
        message = null;
        const result = await withGarminLogin(
            actions!.userId,
            () => uploadWorkoutToGarmin(actions!.userId, session.id),
            () =>
                askGarminCredentials(modalStore!, {
                    body: m.session_garmin_login_body(),
                }),
        );
        busy = false;
        sending = false;
        if (result.ok) message = m.session_sent_to_garmin();
        else if (result.code !== 'LOGIN_CANCELLED')
            message = 'message' in result ? String(result.message) : m.session_send_failed();
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
            {#if session.status === 'DONE' && session.activityId}
                <p class="text-xs text-emerald-400">
                    ✓ {linked ? m.session_linked_to({ name: linked.name }) : m.session_linked()}
                </p>
            {:else if session.status === 'DONE'}
                <p class="text-xs text-emerald-400">✓ {m.session_done()}</p>
            {:else if session.notConfirmed}
                <p class="flex items-center gap-1 text-xs text-amber-300">
                    {m.session_not_confirmed()}
                    <InfoTooltip id="tip-unconfirmed-{session.id}" ariaLabel={m.help_aria()} placement="top"
                        >{m.help_not_confirmed()}</InfoTooltip>
                </p>
            {:else if session.status === 'SKIPPED'}
                <p class="text-xs text-slate-500">{m.session_skipped()}</p>
            {/if}
            {#if running?.keySession}
                <p class="text-xs text-amber-300">★ {running.reason}</p>
            {/if}
        </div>
    </header>

    {#if running}
        {#if session.staleAnchor}
            <p class="text-xs text-amber-300" role="note">{m.session_stale_anchor()}</p>
        {/if}
        <ul class="mt-1 space-y-0.5 text-sm text-slate-300">
            {#each stepLines(running.steps, schoolId) as line}
                <li class={line.nested ? 'pl-4 border-l border-slate-700' : ''}>
                    {line.text}{#if line.note}<span class="text-slate-500"> · {line.note}</span>{/if}
                </li>
            {/each}
        </ul>
    {:else if strength}
        <p class="text-xs text-slate-400">
            {strength.durationMin} min{strength.heavy ? ` · ${m.session_heavy()}` : ''}
        </p>
        <ul class="mt-1 space-y-0.5 text-sm text-slate-300">
            {#each strength.exercises as e}
                <li>{e.name}: {e.sets} × {e.reps}{e.load ? ` @ ${e.load}` : ''}</li>
            {/each}
        </ul>
    {:else if other}
        <p class="text-sm text-slate-300">
            {other.modality ? `${otherModalityLabel(other.modality)}, ` : ''}{other.durationMin} min,
            {otherEffortLabel(other.effort)}
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
            <div class="mt-2 flex flex-wrap gap-0.5 text-xs">
                {#if session.status === 'PLANNED'}
                    <button
                        type="button"
                        class="gc-ghost gc-icon"
                        title={m.session_mark_done()}
                        aria-label={m.session_mark_done()}
                        disabled={busy}
                        on:click={() => mark('DONE')}><CheckIcon size="12" /></button>
                    <button
                        type="button"
                        class="gc-ghost gc-icon"
                        title={m.session_skip()}
                        aria-label={m.session_skip()}
                        disabled={busy}
                        on:click={() => mark('SKIPPED')}><SkipForwardIcon size="12" /></button>
                    <button
                        type="button"
                        class="gc-ghost gc-icon"
                        title={m.session_edit()}
                        aria-label={m.session_edit()}
                        disabled={busy}
                        on:click={() => (editing = true)}><Edit2Icon size="12" /></button>
                {:else if !session.activityId}
                    <button
                        type="button"
                        class="gc-ghost gc-icon"
                        title={m.session_reopen()}
                        aria-label={m.session_reopen()}
                        disabled={busy}
                        on:click={() => mark('PLANNED')}><RotateCcwIcon size="12" /></button>
                {/if}
                {#if session.activityId && actions.activities}
                    <button
                        type="button"
                        class="gc-ghost gc-icon"
                        title={m.session_unlink()}
                        aria-label={m.session_unlink()}
                        disabled={busy}
                        on:click={unlink}><SlashIcon size="12" /></button>
                {/if}
                {#if session.kind !== 'OTHER'}
                    <button
                        type="button"
                        class="gc-ghost gc-icon"
                        class:gc-sending={sending}
                        title={sending ? m.session_sending_to_garmin() : m.session_send_to_garmin()}
                        aria-label={sending ? m.session_sending_to_garmin() : m.session_send_to_garmin()}
                        aria-busy={sending}
                        disabled={busy}
                        on:click={sendToGarmin}><UploadCloudIcon size="12" /></button>
                {/if}
            </div>
            {#if candidates.length > 0}
                <form class="mt-2 flex min-w-0 items-center gap-1 text-xs" on:submit|preventDefault={link}>
                    <select
                        class="gc-link-select min-w-0 flex-1"
                        title={chosenActivity ? activityLabel(chosenActivity) : m.session_link_prompt()}
                        aria-label={m.session_synced_activity()}
                        bind:value={chosen}>
                        <option value="">{m.session_link_prompt()}</option>
                        {#each candidates as a (a.id)}
                            <option value={a.id}>{activityLabel(a)}</option>
                        {/each}
                    </select>
                    <button
                        type="submit"
                        class="gc-ghost gc-icon"
                        title={m.session_link_chosen()}
                        aria-label={m.session_link_chosen()}
                        disabled={busy || !chosen}><LinkIcon size="12" /></button>
                    <InfoTooltip id="tip-link-{session.id}" ariaLabel={m.help_aria()} placement="top"
                        >{m.help_link()}</InfoTooltip>
                </form>
            {/if}
            {#if timeTrialM && session.status === 'PLANNED'}
                <form class="mt-2 flex flex-wrap items-center gap-1 text-xs" on:submit|preventDefault={saveTimeTrial}>
                    <span class="text-sky-300">⏱ {m.session_time_trial_result({ km: timeTrialM / 1000 })}</span>
                    <input
                        class="w-14"
                        type="number"
                        min="0"
                        placeholder="min"
                        aria-label={m.common_minutes()}
                        bind:value={ttMinutes} />
                    <input
                        class="w-14"
                        type="number"
                        min="0"
                        max="59"
                        placeholder="s"
                        aria-label={m.common_seconds()}
                        bind:value={ttSeconds} />
                    <button
                        type="submit"
                        class="gc-ghost gc-icon"
                        title={m.session_save_time_trial()}
                        aria-label={m.session_save_time_trial()}
                        disabled={busy || !ttMinutes}><SaveIcon size="12" /></button>
                </form>
            {/if}
        {/if}
        {#if sending}
            <p class="gc-sending-note mt-1 text-xs text-sky-300" role="status">{m.session_sending_to_garmin()}</p>
        {:else if message}<p class="mt-1 text-xs text-slate-300" role="status">{message}</p>{/if}
    {/if}
</article>

<style>
    .gc-session {
        background: rgba(2, 6, 23, 0.6);
        border: 1px solid rgba(148, 163, 184, 0.2);
        padding: 0.5rem 0.75rem;
    }
    .gc-ghost.gc-icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 0.2rem;
        letter-spacing: 0;
        line-height: 1;
        transition:
            color 0.15s,
            border-color 0.15s,
            background-color 0.15s;
    }
    .gc-ghost.gc-icon:hover:not(:disabled) {
        color: #f8fafc;
        border-color: #38bdf8;
        background-color: rgba(56, 189, 248, 0.15);
    }
    /* The upload icon pulses and the note fades while the workout goes to Garmin. */
    .gc-sending {
        color: #38bdf8;
        border-color: #38bdf8;
        animation: gc-sending 1s ease-in-out infinite;
    }
    .gc-sending-note {
        animation: gc-sending 1.6s ease-in-out infinite;
    }
    @keyframes gc-sending {
        50% {
            opacity: 0.4;
        }
    }
    @media (prefers-reduced-motion: reduce) {
        .gc-sending,
        .gc-sending-note {
            animation: none;
        }
    }
    .gc-link-select {
        width: 100%;
        padding: 0.15rem 0.25rem;
        font-size: 0.75rem;
        text-overflow: ellipsis;
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
