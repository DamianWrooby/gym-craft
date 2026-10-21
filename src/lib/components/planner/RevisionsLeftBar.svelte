<script lang="ts">
    // Revisions left this month (story 73): only revisions that returned a result count.
    export let revisions: { used: number; cap: number };

    $: left = Math.max(0, revisions.cap - revisions.used);
</script>

<div class="gc-stat space-y-1">
    <div class="text-xs uppercase tracking-widest text-slate-500">Revisions left</div>
    <div
        role="meter"
        aria-label="Revisions left"
        aria-valuemin={0}
        aria-valuemax={revisions.cap}
        aria-valuenow={left}
        class="h-2 bg-slate-700/40 overflow-hidden">
        <div class="h-full bg-sky-400" style="width: {revisions.cap ? (left / revisions.cap) * 100 : 0}%" />
    </div>
    <p class="text-sm text-slate-200">{left} of {revisions.cap} left this month</p>
</div>
