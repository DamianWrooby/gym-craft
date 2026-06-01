<script lang="ts">
    import { TargetIcon } from 'svelte-feather-icons';
    import Markdown from '$lib/components/markdown/Markdown.svelte';

    export let source: string;
</script>

<section class="card variant-soft-primary p-5">
    <header class="flex items-center gap-2 mb-3">
        <TargetIcon size="20" />
        <h2 class="h3 font-semibold m-0">Recommendations for next week</h2>
    </header>
    <Markdown {source} />
</section>
