<script lang="ts">
    // What a school is and what sessions to expect. Everything shown comes from the catalogue.
    import type { SchoolDefinition } from '$lib/planner/schools/types';
    import { CUTBACK_CAP } from '$lib/planner/schools/gymcraft-rules';

    export let school: SchoolDefinition | null = null;

    let dialog: HTMLDialogElement;

    $: if (dialog) {
        if (school && !dialog.open) dialog.showModal();
        if (!school && dialog.open) dialog.close();
    }

    $: totalWeeks = school ? school.phases.reduce((n, p) => n + p.idealWeeks.value, 0) : 0;
    $: loadingWeeks = school?.cutbackCadence.value ?? CUTBACK_CAP.value;
</script>

<!-- Backdrop click closes; the keyboard path is the native Esc key. -->
<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-noninteractive-element-interactions -->
<dialog
    bind:this={dialog}
    class="gc-panel gc-dialog w-[min(42rem,calc(100vw-2rem))] max-h-[85vh] overflow-y-auto p-0 text-slate-200"
    aria-labelledby="school-details-title"
    on:close={() => (school = null)}
    on:click={(e) => e.target === dialog && dialog.close()}>
    {#if school}
        <div class="p-6 space-y-5">
            <header class="flex items-start justify-between gap-4">
                <div>
                    <div class="text-[11px] uppercase tracking-[0.3em] text-rose-400">Training school</div>
                    <h2 id="school-details-title" class="text-2xl font-black">{school.name}</h2>
                    <p class="text-sm text-sky-300">{school.tagline}</p>
                </div>
                <button type="button" class="gc-ghost" aria-label="Close" on:click={() => dialog.close()}>✕</button>
            </header>

            <p class="text-sm text-slate-300">{school.lore}</p>

            <section class="space-y-2">
                <h3 class="text-xs uppercase tracking-[0.25em] text-slate-400">
                    Phases · {totalWeeks} weeks at full length
                </h3>
                <ol class="space-y-2">
                    {#each school.phases as p, i}
                        <li class="border-l-2 border-rose-500/60 pl-3">
                            <div class="font-bold">
                                {i + 1}. {p.name}
                                <span class="text-sm font-normal text-slate-400">· {p.idealWeeks.value} weeks</span>
                            </div>
                            <p class="text-sm text-slate-300">{p.intent}</p>
                        </li>
                    {/each}
                </ol>
            </section>

            <section class="space-y-2">
                <h3 class="text-xs uppercase tracking-[0.25em] text-slate-400">Key sessions every week</h3>
                <ul class="space-y-1">
                    {#each school.keySessions as k}
                        <li class="text-sm"><b>{k.name}:</b> <span class="text-slate-300">{k.reason}</span></li>
                    {/each}
                </ul>
                <p class="text-sm text-slate-400">The other runs are easy.</p>
            </section>

            <section class="space-y-2">
                <h3 class="text-xs uppercase tracking-[0.25em] text-slate-400">Intensities</h3>
                <ul class="flex flex-wrap gap-2">
                    {#each school.intensityLabels as l}
                        <li class="rounded border border-slate-600 px-2 py-1 text-sm">
                            {l.name}
                            <span class="text-slate-400"
                                >· by {l.targetType.value === 'HR' ? 'heart rate' : 'pace'}</span>
                        </li>
                    {/each}
                </ul>
                {#if school.intensityLabels.some((l) => l.targetType.value === 'PACE')}
                    <p class="text-sm text-slate-400">Paces come from your recent race result or time trial.</p>
                {:else}
                    <p class="text-sm text-slate-400">Intensity comes from your heart-rate zones.</p>
                {/if}
            </section>

            <section class="space-y-2">
                <h3 class="text-xs uppercase tracking-[0.25em] text-slate-400">Easy weeks and strength</h3>
                <p class="text-sm text-slate-300">
                    After at most {loadingWeeks} harder weeks, one easy week with less volume follows.
                </p>
                <p class="text-sm text-slate-300">
                    Strength sessions: {school.strengthTemplates.map((t) => t.name.toLowerCase()).join(' or ')}. They
                    get fewer as race day comes closer.
                </p>
            </section>
        </div>
    {/if}
</dialog>

<style>
    .gc-dialog {
        /* The cut corner clips the close button area on small screens. */
        clip-path: none;
    }
    .gc-dialog::backdrop {
        background: rgba(2, 6, 23, 0.75);
        backdrop-filter: blur(2px);
    }
</style>
