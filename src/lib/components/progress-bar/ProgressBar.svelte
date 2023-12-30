<script lang="ts">
    export let max: number;
    export let curr: number;
    export let duration: number;
</script>

<div class="bg-primary-900 w-full h-2 absolute left-0 top-0">
    <div
        class="bg-primary-500 h-full"
        style:width="{(curr / max) * 100}%"
        style:transition="width {duration}ms ease" />
</div>
