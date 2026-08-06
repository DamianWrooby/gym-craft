<script lang="ts">
    import { renderMarkdown } from '$lib/utils/sanitize-markdown';

    export let source: string;

    $: safeHtml = renderMarkdown(source);
</script>

<div class="markdown prose dark:prose-invert max-w-none">
    <!-- eslint-disable-next-line svelte/no-at-html-tags -- sanitized against an allowlist in renderMarkdown() -->
    {@html safeHtml}
</div>

<style>
    .markdown :global(h2) {
        font-size: 1.25rem;
        font-weight: 700;
        margin-top: 1rem;
        margin-bottom: 0.5rem;
    }
    .markdown :global(h3) {
        font-size: 1.125rem;
        font-weight: 600;
        margin-top: 0.75rem;
        margin-bottom: 0.5rem;
    }
    .markdown :global(p) {
        margin-bottom: 0.5rem;
    }
    .markdown :global(ul),
    .markdown :global(ol) {
        margin-left: 1.5rem;
        margin-bottom: 0.5rem;
        list-style: disc;
    }
    .markdown :global(ol) {
        list-style: decimal;
    }
    .markdown :global(blockquote) {
        border-left: 3px solid currentColor;
        padding-left: 0.75rem;
        opacity: 0.8;
        font-style: italic;
    }
    .markdown :global(a) {
        text-decoration: underline;
    }
</style>
