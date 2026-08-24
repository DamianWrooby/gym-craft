<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import { PlusIcon } from 'svelte-feather-icons';
    import type { WeekCell } from '$lib/server/reports/week-timeline';
    import { statusStyle, statusLabel, STATUS_LABEL } from '$lib/utils/load-status';

    /** Newest-first, as built by buildWeekTimeline. */
    export let timeline: WeekCell[] = [];

    const dispatch = createEventDispatcher<{
        open: { reportId: string };
        generate: { periodStart: string; periodEnd: string };
    }>();

    // Render oldest → newest, left to right.
    $: weeks = [...timeline].reverse();

    $: maxLoad = weeks.reduce(
        (max, w) => (w.weeklyTotalLoad != null && w.weeklyTotalLoad > max ? w.weeklyTotalLoad : max),
        0,
    );

    function barPct(load: number | null): number {
        if (load == null || maxLoad <= 0) return 0;
        // Floor at 6% so a real-but-tiny load is still a visible bar, not a sliver.
        return Math.max(6, Math.round((load / maxLoad) * 100));
    }

    function shortLabel(periodStart: string): string {
        return new Date(`${periodStart}T00:00:00Z`).toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
            timeZone: 'UTC',
        });
    }

    function weekTitle(cell: WeekCell): string {
        const range = `${shortLabel(cell.periodStart)}–${shortLabel(cell.periodEnd)}`;
        if (cell.state === 'report') {
            return `${range} · Load ${cell.weeklyTotalLoad ?? '—'} · ${statusLabel(cell.acwrStatus)}`;
        }
        if (cell.state === 'gap') return `${range} · Trained, no report — click to generate`;
        return `${range} · No training`;
    }

    function onCellClick(cell: WeekCell) {
        if (cell.state === 'report' && cell.reportId) {
            dispatch('open', { reportId: cell.reportId });
        } else if (cell.state === 'gap') {
            dispatch('generate', { periodStart: cell.periodStart, periodEnd: cell.periodEnd });
        }
    }

    const legend = Object.entries(STATUS_LABEL) as Array<[keyof typeof STATUS_LABEL, string]>;
</script>

<div class="card p-4">
    <div class="flex items-center justify-between mb-3">
        <h3 class="font-semibold">Training load — last 12 weeks</h3>
        <div class="hidden sm:flex flex-wrap gap-x-3 gap-y-1 text-xs opacity-80">
            {#each legend as [status, label]}
                <span class="inline-flex items-center gap-1">
                    <span class="inline-block w-2.5 h-2.5 rounded-sm {statusStyle(status).bar}"></span>
                    {label}
                </span>
            {/each}
        </div>
    </div>

    <div class="overflow-x-auto overflow-y-hidden">
        <div class="flex items-end gap-1.5 min-w-[36rem]">
            {#each weeks as cell (cell.periodStart)}
                {@const style = statusStyle(cell.acwrStatus)}
                <button
                    type="button"
                    class="group flex-1 flex flex-col items-center focus:outline-none"
                    class:cursor-pointer={cell.state !== 'empty'}
                    class:cursor-default={cell.state === 'empty'}
                    title={weekTitle(cell)}
                    aria-label={weekTitle(cell)}
                    disabled={cell.state === 'empty'}
                    on:click={() => onCellClick(cell)}>
                    <div class="w-full h-48 flex flex-col justify-end">
                        {#if cell.state === 'report'}
                            <div
                                class="w-full rounded-t-sm {style.bar} transition-all group-hover:opacity-80"
                                style="height: {barPct(cell.weeklyTotalLoad)}%">
                            </div>
                        {:else if cell.state === 'gap'}
                            <div
                                class="w-full h-8 rounded-sm border-2 border-dashed border-surface-400 dark:border-surface-500
                                    flex items-center justify-center text-surface-400 dark:text-surface-500
                                    group-hover:border-primary-500 group-hover:text-primary-500 transition-colors">
                                <PlusIcon size="16" />
                            </div>
                        {:else}
                            <div class="w-full h-1 rounded-sm bg-surface-300/50 dark:bg-surface-700/50"></div>
                        {/if}
                    </div>
                    <span class="mt-1 text-[10px] leading-tight opacity-60 whitespace-nowrap">
                        {shortLabel(cell.periodStart)}
                    </span>
                </button>
            {/each}
        </div>
    </div>

    <p class="text-xs opacity-60 mt-2">
        Bars are weeks with a report (height = weekly load). Dashed slots are weeks you trained but have no report —
        click to generate one.
    </p>
</div>
