<script lang="ts">
    import { onMount } from 'svelte';
    import { getModalStore } from '@skeletonlabs/skeleton';
    import type { ModalSettings } from '@skeletonlabs/skeleton';
    import { appConfig } from '@/constants/app.constants';

    export let plan: string;
    export let generatedPlansNumber: number;

    const modalStore = getModalStore();
    const plansLeft = appConfig.planLimit - generatedPlansNumber;

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

<div class="h-full flex flex-col items-center justify-center pt-8">
    <div class="card md:w-[50%] p-16 mb-8">
        <h2 class="h2 text-center text-xl py-10">
            We have crafted a plan based on the data you entered:
        </h2>
        {@html plan}
    </div>
</div>
