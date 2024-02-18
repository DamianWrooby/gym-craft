<script lang="ts">
    import { page } from '$app/stores';
    import { onMount } from 'svelte';
    import { getModalStore } from '@skeletonlabs/skeleton';

    const modalStore = getModalStore();

    onMount(() => {
        clearModals();
    });

    const clearModals = () => {
        modalStore.clear();
    };

    console.log($page.data.plans);
</script>

<div></div>
