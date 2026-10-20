<script lang="ts">
    import SportIcon from '$lib/components/sport-icon/SportIcon.svelte';
    import { stepLines } from '$lib/planner/session-format';
    import type { PlanViewSession } from '$lib/planner/plan-view';

    export let session: PlanViewSession;
    export let schoolId: string | null;

    $: body = session.body;
    $: running = 'steps' in body ? body : null;
    $: strength = 'exercises' in body ? body : null;
    $: other = !running && !strength && 'effort' in body ? body : null;
</script>

<article class="gc-session" data-kind={session.kind} aria-label={body.title}>
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
        <p class="text-sm text-slate-300">{other.durationMin} min, {other.effort}</p>
    {/if}
</article>

<style>
    .gc-session {
        background: rgba(2, 6, 23, 0.6);
        border: 1px solid rgba(148, 163, 184, 0.2);
        padding: 0.5rem 0.75rem;
    }
    .gc-session[data-kind='STRENGTH'] {
        border-left: 2px solid #e11d48;
    }
    .gc-session[data-kind='RUNNING'] {
        border-left: 2px solid #38bdf8;
    }
</style>
