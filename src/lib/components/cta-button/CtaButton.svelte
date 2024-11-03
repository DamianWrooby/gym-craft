<script lang="ts">
    import { ArrowRightIcon } from 'svelte-feather-icons';

    export let url: string;
    export let text: string;
</script>

<div class="p-5 text-center">
    <a href={url} class="btn variant-filled-primary group">
        <ArrowRightIcon class="group-hover:animate-pulse" />
        <span>{text}</span>
    </a>
</div>
