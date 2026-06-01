<script lang="ts">
    export let label: string;
    export let value: string;
    export let valueClass = '';
</script>

<div class="rounded-xl border border-surface-300 dark:border-surface-700 p-3 bg-surface-100 dark:bg-surface-800">
    <div class="flex items-center gap-1">
        <p class="text-xs opacity-70 uppercase tracking-wide">{label}</p>
        <slot name="label-suffix" />
    </div>
    <p class="text-lg font-semibold mt-1 {valueClass}">{value}</p>
</div>
