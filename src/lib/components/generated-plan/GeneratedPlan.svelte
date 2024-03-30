<script lang="ts">
    import { onMount } from 'svelte';
    import { getModalStore } from '@skeletonlabs/skeleton';
    import type { ModalSettings } from '@skeletonlabs/skeleton';
    import Card from '@components/card/Card.svelte';

    export let plan: string;
    export let plansLeft: number;

    const modalStore = getModalStore();

    onMount(() => {
        openInfoModal();
    });

    const openInfoModal = () => {
        const modal: ModalSettings = {
            type: 'alert',
            title: 'Information',
            body: `<p>Your plan has been generated and automatically added to <a class="text-secondary-400 hover:text-tertiary-50" href="/my-plans">your plan list</a>.</p> <br> <p>You can still generate the following number of plans: ${plansLeft}</p>`,
            buttonTextCancel: 'Ok',
        };
        modalStore.trigger(modal);
    };
</script>

<Card>
    <h2 class="h2 text-center text-xl py-10">We have crafted a plan based on the data you entered:</h2>
    {@html plan}
</Card>
