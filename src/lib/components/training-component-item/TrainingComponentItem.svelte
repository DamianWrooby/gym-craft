<script lang="ts">
    import type { IconComponent } from '@models/icon/icon.model';

    export let title: string;
    export let description: string;
    export let icon: IconComponent;
</script>

<div class="card flex flex-col px-5 pb-5 bg-gradient-to-br dark:from-surface-700 to-surface-900 sm:aspect-square">
    <header class="card-header">
        <svelte:component this={icon} class="mx-auto my-2 text-secondary-500" size={'40'} />
        <h4 class="h4 text-center font-semibold pb-4">{title}</h4>
    </header>
    <p class="text-left text-pretty font-light text-lg md:text-xl pb-5">
        {description}
    </p>
</div>

<style>
    .card {
        flex: 0 0 100%;

        @media (min-width: 412px) {
            flex: 0 0 calc(50% - 1rem);
        }

        @media (min-width: 768px) {
            flex: 0 0 calc(33% - 1rem);
        }
    }
</style>
