<script lang="ts">
    import { Accordion, AccordionItem } from '@skeletonlabs/skeleton';

    export let items: Array<{ title: string; content: string }>;
</script>

<Accordion
    width="w-full lg:w-1/2"
    class="rounded rounded-3xl border border-surface-900 dark:border-surface-500 p-3 m-auto">
    {#each items as item}
        <AccordionItem>
            <svelte:fragment slot="summary">
                <h3 class="h3 font-semibold">{item.title}</h3>
            </svelte:fragment>
            <svelte:fragment slot="content">
                <p class="text-left">{item.content}</p>
            </svelte:fragment>
        </AccordionItem>
    {/each}
</Accordion>
