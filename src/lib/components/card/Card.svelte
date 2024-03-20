<script lang="ts">
    export let width: string = '50';
</script>

<div class="h-full flex flex-col items-center justify-center pt-8">
    <div class={`card w-full md:w-[${width}%] p-6 md:p-16 mb-8`}>
        <slot />
    </div>
</div>
