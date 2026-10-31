<script lang="ts">
    import { m } from '$lib/paraglide/messages.js';
    import { getLocale } from '$lib/paraglide/runtime.js';
    import { FlagIcon } from 'svelte-feather-icons';
    import type { PlanView } from '$lib/planner/plan-view';

    export let plan: PlanView;

    const DAY_MS = 86_400_000;
    const utc = (iso: string) => Date.parse(`${iso}T00:00:00Z`);

    // The athlete's local date, so the countdown matches their own calendar.
    const now = new Date();
    const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());

    $: daysLeft = Math.round((utc(plan.endDate) - today) / DAY_MS);
    $: totalDays = Math.max(1, Math.round((utc(plan.endDate) - utc(plan.startDate)) / DAY_MS));
    $: progress = Math.min(100, Math.max(0, Math.round(((totalDays - Math.max(daysLeft, 0)) / totalDays) * 100)));
    $: countdown =
        daysLeft > 1
            ? m.plan_goal_days_left({ days: daysLeft })
            : daysLeft === 1
              ? m.plan_goal_tomorrow()
              : daysLeft === 0
                ? m.plan_goal_today()
                : m.plan_goal_passed();
    $: goalDate = new Date(utc(plan.endDate)).toLocaleDateString(getLocale(), {
        weekday: 'short',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
    });
</script>

<header class="gc-panel p-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,26rem)] lg:items-center">
    <div class="space-y-2 min-w-0">
        <div class="text-[11px] uppercase tracking-[0.3em] text-rose-400">{m.plan_training_school()}</div>
        <h1 class="text-2xl font-black tracking-wide text-slate-50">{plan.school.name}</h1>
        <p class="text-sm text-sky-300">{plan.school.tagline}</p>
        <p class="text-sm text-slate-300 max-w-prose">{plan.school.lore}</p>
    </div>

    <section class="gc-goal p-4 space-y-3" aria-label={m.plan_goal({ goal: plan.goalName })}>
        <div class="flex items-center gap-2 text-[11px] uppercase tracking-[0.3em] text-amber-300">
            <FlagIcon size="14" />
            {m.plan_goal_label()}
        </div>
        <p class="text-2xl font-black leading-tight text-slate-50 break-words">{plan.goalName}</p>
        <div class="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <span class="text-sm text-slate-300">{goalDate}</span>
            <span class="text-lg font-extrabold text-amber-300">{countdown}</span>
        </div>
        <div
            class="gc-goal-track"
            role="progressbar"
            aria-label={m.plan_goal_progress()}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}>
            <div class="gc-goal-fill" style="width: {progress}%" />
        </div>
        <p class="text-xs text-slate-500">{plan.startDate} → {plan.endDate}</p>
    </section>
</header>

<style>
    .gc-goal {
        background: linear-gradient(135deg, rgba(251, 191, 36, 0.12), rgba(2, 6, 23, 0.6) 60%);
        border: 1px solid rgba(251, 191, 36, 0.45);
        border-left: 3px solid #fbbf24;
        box-shadow: 0 0 24px rgba(251, 191, 36, 0.12);
    }
    .gc-goal-track {
        height: 0.4rem;
        background: rgba(148, 163, 184, 0.2);
        border-radius: 999px;
        overflow: hidden;
    }
    .gc-goal-fill {
        height: 100%;
        background: linear-gradient(90deg, #f59e0b, #fbbf24);
        border-radius: 999px;
    }
</style>
