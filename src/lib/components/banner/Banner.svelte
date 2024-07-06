<script lang="ts">
    import { fade } from 'svelte/transition';
    import { createEventDispatcher } from 'svelte';

    export let title: string;
    export let message: string;

    const dispatch = createEventDispatcher();

    const onAccept = () => {
        dispatch('accept');
    };
</script>

<aside
    class="alert variant-filled-tertiary dark:variant-filled-surface fixed flex-col z-10 w-full bottom-20 md:w-1/4 md:right-2.5"
    transition:fade|local={{ duration: 50 }}>
    <!-- Message -->
    <div class="alert-message">
        <h3 class="h3">{title}</h3>
        <p>
            {message}
        </p>
    </div>
    <!-- Actions -->
    <div class="alert-actions flex justify-end w-full">
        <button on:click={() => onAccept()} type="button" class="btn variant-filled-primary">Accept</button>
    </div>
</aside>
