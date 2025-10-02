<script lang="ts">
    import type { IconComponent } from '@models/icon/icon.model';
    import { ChevronsDownIcon } from 'svelte-feather-icons';
    import { onMount } from 'svelte';

    export let verticalLabel: string;
    export let numbering: number;
    export let title: string;
    export let description: string;
    export let isEven: boolean;
    export let isLast: boolean;
    export let icon: IconComponent;

    let verticalLabelElement: HTMLElement;
    let iconSize: string = '52';

    onMount(() => {
        handleResize();
        window.addEventListener('resize', handleResize);
    });

    const setVerticalLabelWidth = () => {
        if (verticalLabelElement) {
            verticalLabelElement.style.top = `${verticalLabelElement.clientWidth - 21}px`;
        }
    };

    const setIconSize = () => {
        if (window.innerWidth > 768) {
            iconSize = '72';
        } else {
            iconSize = '52';
        }
    };

    const handleResize = () => {
        setVerticalLabelWidth();
        setIconSize();
    };
</script>

<article
    class="w-full flex justify-start text-left font-light max-w-xl xl:max-w-full"
    class:sm:flex-row-reverse={!isEven}>
    <div class="sm:w-1/2 p-8">
        <div class="relative pl-6 h-full flex flex-col flex-auto justify-between border-l">
            <p
                bind:this={verticalLabelElement}
                class="absolute uppercase text-base -rotate-90 origin-bottom-left left-0 text-surface-200 tracking-wide">
                {verticalLabel}
            </p>
            <div>
                <p class="h2 font-bold">{`0${numbering}`}</p>
                <h4 class="h3 text-nowrap">{title}</h4>
            </div>
            <div class="desc flex items-end">
                <p class="pt-4 text-lg md:text-xl">{description}</p>
            </div>
        </div>
    </div>
    <div class="w-1/2 hidden sm:block p-5 flex class:justify-center={!isEven}">
        <div
            class="card h-full bg-gradient-to-br from-surface-700 to-surface-900 aspect-square p-8 flex justify-center items-center">
            <svelte:component this={icon} size={iconSize} />
        </div>
    </div>
</article>
{#if !isLast}
    <ChevronsDownIcon class="m-auto text-primary-500 animate-bounce" size={'40'} />
{/if}

<style>
    .desc {
        min-height: calc(1em * 2 * 3);
    }
</style>
