<script lang="ts">
    import { m } from '$lib/paraglide/messages.js';
    import InfoTooltip from '$lib/components/info-tooltip/InfoTooltip.svelte';
    // Revisions left this month (story 73): only revisions that returned a result count.
    export let revisions: { used: number; cap: number };

    $: left = Math.max(0, revisions.cap - revisions.used);
</script>

<div class="gc-stat space-y-1">
    <div class="flex items-center gap-1 text-xs uppercase tracking-widest text-slate-500">
        {m.revisions_left()}
        <InfoTooltip id="tip-revisions-left" ariaLabel={m.help_aria()} placement="top"
            >{m.help_revisions_left()}</InfoTooltip>
    </div>
    <div
        role="meter"
        aria-label={m.revisions_left()}
        aria-valuemin={0}
        aria-valuemax={revisions.cap}
        aria-valuenow={left}
        class="h-2 bg-slate-700/40 overflow-hidden">
        <div class="h-full bg-sky-400" style="width: {revisions.cap ? (left / revisions.cap) * 100 : 0}%" />
    </div>
    <p class="text-sm text-slate-200">{m.revisions_left_count({ left, cap: revisions.cap })}</p>
</div>
