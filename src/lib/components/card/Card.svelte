<script lang="ts">
    export let width: string = '1/2';
</script>

<div class="h-full flex flex-col items-center justify-center pt-8">
    <div
        class="card w-full p-6 md:p-16 mb-8"
        class:xl:w-[25%]={width === '1/4'}
        class:xl:w-[50%]={width === '1/2'}
        class:xl:w-[75%]={width === '3/4'}>
        <slot />
    </div>
</div>
