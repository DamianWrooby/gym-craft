<script lang="ts">
    import { highlight } from '$lib/utils/highlight';

    /** A compiled message with [[accent]] marks. */
    export let text: string;
    export let accent = 'text-secondary-400';
</script>

<!-- eslint-disable-next-line svelte/no-at-html-tags -- compiled message strings only, with `<` escaped by highlight() -->
{@html highlight(text, accent)}
