<script lang="ts">
    import { m } from '$lib/paraglide/messages.js';
    import { sessionsDone, type PlanViewWeek } from '$lib/planner/plan-view';

    export let week: Pick<PlanViewWeek, 'sessions'>;

    $: count = sessionsDone(week);
</script>

<div class="gc-stat space-y-1">
    <div class="text-xs uppercase tracking-widest text-slate-500">{m.sessions_done()}</div>
    <div
        role="meter"
        aria-label={m.sessions_done()}
        aria-valuemin={0}
        aria-valuemax={count.total}
        aria-valuenow={count.done}
        class="h-2 bg-slate-700/40 overflow-hidden">
        <div class="h-full bg-sky-400" style="width: {count.total ? (count.done / count.total) * 100 : 0}%" />
    </div>
    <p class="text-sm text-slate-200">{m.sessions_done_count({ done: count.done, total: count.total })}</p>
</div>
