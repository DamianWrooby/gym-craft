<script lang="ts">
    import { getModalStore } from '@skeletonlabs/skeleton';
    import type { SvelteComponent } from 'svelte';
    import { ChevronsRightIcon } from 'svelte-feather-icons';

    // Props
    /** Exposes parent props to this component. */
    export let parent: SvelteComponent;

    const modalStore = getModalStore();

    // Form Data
    const formData = {
        email: '',
        password: '',
    };

    function onFormSubmit(): void {
        if ($modalStore[0].response) $modalStore[0].response(formData);
        modalStore.close();
    }

    const cBase = 'card p-4 w-modal shadow-xl space-y-4';
    const cHeader = 'text-2xl font-bold';
</script>

{#if $modalStore[0]}
    <div class="modal-example-form {cBase}">
        <header class={cHeader}>{$modalStore[0].title ?? '(title missing)'}</header>
        <article>{$modalStore[0].body ?? '(body missing)'}</article>
        <div class="p-1 max-w-sm m-auto">
            <label class="label" for="email">Email</label>
            <input
                class="input"
                id="email"
                name="email"
                type="email"
                autocomplete="email"
                bind:value={formData.email}
                required />
        </div>

        <div class="p-1 max-w-sm m-auto pb-5">
            <label class="label" for="password">Password</label>
            <input
                class="input"
                id="password"
                name="password"
                type="password"
                autocomplete="current-password"
                bind:value={formData.password}
                required />
        </div>
        <!-- prettier-ignore -->
        <footer class="flex justify-center">
                <button class="btn variant-filled-tertiary mr-2" on:click|preventDefault={parent.onClose}>{parent.buttonTextCancel}</button>
                <button class="btn variant-filled-primary" on:click={onFormSubmit} >
                    <ChevronsRightIcon class="group-hover:animate-pulse" />
                    <span>{parent.buttonTextConfirm}</span>
                </button>
            </footer>
    </div>
{/if}
