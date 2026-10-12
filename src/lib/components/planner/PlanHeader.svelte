<script lang="ts">
    import type { PlanView } from '$lib/planner/plan-view';

    export let plan: PlanView;
</script>

<header class="gc-panel p-5 space-y-2">
    <div class="text-[11px] uppercase tracking-[0.3em] text-rose-400">Training school</div>
    <h1 class="text-2xl font-black tracking-wide text-slate-50">{plan.school.name}</h1>
    <p class="text-sm text-sky-300">{plan.school.tagline}</p>
    <p class="text-sm text-slate-300 max-w-prose">{plan.school.lore}</p>
    <p class="text-xs text-slate-500">Goal: {plan.goalName} · {plan.startDate} → {plan.endDate}</p>
</header>
