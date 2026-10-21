<script lang="ts">
    import SessionCard from './SessionCard.svelte';
    import { addDays } from '$lib/utils/iso-week';
    import type { PlanViewWeek } from '$lib/planner/plan-view';
    import type { TuneUpFixture } from '$lib/planner/core/fixtures';
    import type { SchoolDefinition } from '$lib/planner/schools/types';

    export let week: PlanViewWeek;
    export let schoolId: string | null;
    export let fixtures: TuneUpFixture[] = [];
    export let actions: { userId: string; school: SchoolDefinition | null } | null = null;

    const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    // Both session kinds share one day, interleaved: the week reads as one plan.
    $: days = DAY_NAMES.map((name, i) => {
        const date = addDays(week.startDate, i);
        return {
            name,
            date,
            sessions: week.sessions.filter((s) => s.scheduledDate === date),
            fixtures: fixtures.filter((f) => f.date === date),
        };
    });
</script>

<ol class="grid gap-2 md:grid-cols-7" aria-label="Sessions by day">
    {#each days as day}
        <li class="space-y-1.5">
            <div class="text-xs uppercase tracking-widest text-slate-500">
                {day.name} <span class="text-slate-600">{day.date.slice(5)}</span>
            </div>
            <!-- A tune-up race is a fixed session: the athlete's, never moved or rewritten (story 36). -->
            {#each day.fixtures as fixture (fixture.goalId)}
                <article class="gc-fixture" aria-label="Tune-up race">
                    <p class="font-semibold text-amber-300">⚑ {fixture.name ?? 'Tune-up race'}</p>
                    <p class="text-xs text-slate-400">
                        {fixture.distanceM ? `${fixture.distanceM / 1000} km · ` : ''}fixed
                    </p>
                </article>
            {/each}
            {#each day.sessions as session (session.id)}
                <SessionCard {session} {schoolId} actions={actions && { ...actions, week }} />
            {:else}
                {#if day.fixtures.length === 0}<p class="text-xs text-slate-600">Rest</p>{/if}
            {/each}
        </li>
    {/each}
</ol>

<style>
    .gc-fixture {
        background: rgba(2, 6, 23, 0.6);
        border: 1px solid rgba(251, 191, 36, 0.4);
        border-left: 2px solid #fbbf24;
        padding: 0.5rem 0.75rem;
    }
</style>
