<script lang="ts">
    import { onMount } from 'svelte';
    import { getModalStore } from '@skeletonlabs/skeleton';
    import type { ModalSettings } from '@skeletonlabs/skeleton';
    import Card from '@components/card/Card.svelte';
    import { ArrowRightIcon, ChevronsRightIcon } from 'svelte-feather-icons';

    export let planContent: string;
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
    {@html planContent}
    <div class="w-100 pt-12 flex justify-end">
        <a href="/my-plans" class="btn variant-filled-tertiary group mr-6">
            <span>My plans</span>
            <ArrowRightIcon class="group-hover:animate-pulse" />
        </a>
        <a href="/create-plan" class="btn variant-filled-primary group">
            <span>Create another plan</span>
            <ChevronsRightIcon class="group-hover:animate-pulse" />
        </a>
    </div>
</Card>
