<script lang="ts">
    import SessionCard from './SessionCard.svelte';
    import { addDays } from '$lib/utils/iso-week';
    import type { PlanViewWeek } from '$lib/planner/plan-view';

    export let week: PlanViewWeek;
    export let schoolId: string | null;

    const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    // Both session kinds share one day, interleaved: the week reads as one plan.
    $: days = DAY_NAMES.map((name, i) => {
        const date = addDays(week.startDate, i);
        return { name, date, sessions: week.sessions.filter((s) => s.scheduledDate === date) };
    });
</script>

<ol class="grid gap-2 md:grid-cols-7" aria-label="Sessions by day">
    {#each days as day}
        <li class="space-y-1.5">
            <div class="text-xs uppercase tracking-widest text-slate-500">
                {day.name} <span class="text-slate-600">{day.date.slice(5)}</span>
            </div>
            {#each day.sessions as session (session.id)}
                <SessionCard {session} {schoolId} />
            {:else}
                <p class="text-xs text-slate-600">Rest</p>
            {/each}
        </li>
    {/each}
</ol>
