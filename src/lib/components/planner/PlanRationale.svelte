<script lang="ts">
    // "Why this plan": how the athlete's data shaped the layout, frozen at creation.
    import type { PlanRationale } from '$lib/planner/core/explain';

    export let rationale: PlanRationale;
</script>

<details class="gc-panel p-5 group">
    <summary class="cursor-pointer list-none flex items-center justify-between">
        <span class="text-[11px] uppercase tracking-[0.3em] text-rose-400">Why this plan</span>
        <span class="text-sm text-sky-300 group-open:hidden">Show how your data shaped it ▾</span>
        <span class="text-sm text-sky-300 hidden group-open:inline">Hide ▴</span>
    </summary>
    <div class="mt-4 grid gap-4 md:grid-cols-2">
        {#each rationale.sections as s}
            <section class="border-l-2 border-sky-500/50 pl-3 space-y-1">
                <h3 class="font-bold text-slate-100">{s.title}</h3>
                {#each s.lines as line}<p class="text-sm text-slate-300">{line}</p>{/each}
            </section>
        {/each}
    </div>
</details>
