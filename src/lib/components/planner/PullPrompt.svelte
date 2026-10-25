<script lang="ts">
    import { m } from '$lib/paraglide/messages.js';
    import { invalidateAll } from '$app/navigation';
    import { generateWeek, pullWeek } from '$lib/planner/generation-client';
    import { WEEK_OUTLOOKS, type WeekOutlook } from '$lib/planner/core/pull';
    import type { PlanView } from '$lib/planner/plan-view';

    export let plan: PlanView;
    export let userId: string;
    export let proxySession: string | null;

    const OUTLOOK_NAMES: Record<WeekOutlook, () => string> = {
        NORMAL: m.outlook_normal,
        BUSY: m.outlook_busy,
        TRAVEL: m.outlook_travel,
        ILL: m.outlook_ill,
    };

    const MARKS = ['DONE', 'SKIPPED'] as const;

    $: pull = plan.pull!;
    $: week = plan.weeks[pull.weekIndex];
    let outlook: WeekOutlook = 'NORMAL';
    let marks: Record<string, 'DONE' | 'SKIPPED'> = {};
    let busy = false;
    let error: string | null = null;
    $: allMarked = pull.unconfirmed.every((s) => marks[s.id]);

    async function submit() {
        busy = true;
        error = null;
        const confirmations = Object.entries(marks).map(([sessionId, status]) => ({ sessionId, status }));
        const result = await pullWeek(userId, week.id, { outlook, confirmations });
        if ('error' in result) {
            error = result.error;
            busy = false;
            return;
        }
        if (proxySession) {
            await generateWeek({ userId, weekId: week.id, aiRequestId: result.aiRequestId, session: proxySession });
        }
        await invalidateAll();
        busy = false;
    }
</script>

<section class="gc-panel p-4 space-y-4" aria-label={m.pull_write_week({ n: pull.weekIndex + 1 })}>
    <h2 class="text-lg font-bold text-slate-100">{m.pull_next({ n: pull.weekIndex + 1 })}</h2>

    {#if pull.unconfirmed.length > 0}
        <div class="space-y-2">
            <p class="text-sm text-slate-300">{m.pull_mark_first()}</p>
            <ul class="space-y-2">
                {#each pull.unconfirmed as session (session.id)}
                    <li class="flex flex-wrap items-center justify-between gap-2">
                        <span class="text-sm text-slate-200">{session.scheduledDate} · {session.body.title}</span>
                        <span class="flex gap-2">
                            {#each MARKS as status}
                                <button
                                    type="button"
                                    class={marks[session.id] === status ? 'gc-button' : 'gc-ghost'}
                                    aria-pressed={marks[session.id] === status}
                                    on:click={() => (marks = { ...marks, [session.id]: status })}>
                                    {status === 'DONE' ? m.session_done() : m.session_skipped()}
                                </button>
                            {/each}
                        </span>
                    </li>
                {/each}
            </ul>
        </div>
    {/if}

    <fieldset class="space-y-2">
        <legend class="text-sm text-slate-300">{m.pull_outlook_question({ n: pull.weekIndex + 1 })}</legend>
        <div class="flex flex-wrap gap-2">
            {#each WEEK_OUTLOOKS as option}
                <button
                    type="button"
                    class={outlook === option ? 'gc-button' : 'gc-ghost'}
                    aria-pressed={outlook === option}
                    on:click={() => (outlook = option)}>
                    {OUTLOOK_NAMES[option]()}
                </button>
            {/each}
        </div>
    </fieldset>

    <button type="button" class="gc-button" disabled={busy || !allMarked} on:click={submit}>
        {busy ? m.pull_writing() : m.pull_write_week({ n: pull.weekIndex + 1 })}
    </button>
    {#if busy}<p class="text-sm text-slate-400">{m.pull_wait()}</p>{/if}
    {#if error}<p class="text-sm text-amber-300" role="alert">{error}</p>{/if}
</section>
