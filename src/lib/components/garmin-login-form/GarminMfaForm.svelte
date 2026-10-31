<script lang="ts">
    import { m } from '$lib/paraglide/messages.js';
    import { getModalStore } from '@skeletonlabs/skeleton';
    import type { SvelteComponent } from 'svelte';
    import { ChevronsRightIcon } from 'svelte-feather-icons';

    // Props
    /** Exposes parent props to this component. */
    export let parent: SvelteComponent;

    const modalStore = getModalStore();

    let code = '';

    function onFormSubmit(): void {
        if (!code.trim()) return;
        if ($modalStore[0].response) $modalStore[0].response(code.trim());
        modalStore.close();
    }

    const cBase = 'card p-4 w-modal shadow-xl space-y-4';
    const cHeader = 'text-2xl font-bold';
</script>

{#if $modalStore[0]}
    <form class={cBase} on:submit|preventDefault={onFormSubmit}>
        <header class={cHeader}>{$modalStore[0].title ?? '(title missing)'}</header>
        <article>{$modalStore[0].body ?? '(body missing)'}</article>
        <div class="p-1 max-w-sm m-auto pb-5">
            <label class="label" for="garmin-mfa-code">{m.garmin_mfa_code_label()}</label>
            <input
                class="input"
                id="garmin-mfa-code"
                name="code"
                type="text"
                inputmode="numeric"
                autocomplete="one-time-code"
                bind:value={code}
                required />
        </div>
        <!-- prettier-ignore -->
        <footer class="flex justify-center">
                <button type="button" class="btn variant-filled-tertiary mr-2" on:click|preventDefault={parent.onClose}>{parent.buttonTextCancel}</button>
                <button type="submit" class="btn variant-filled-primary">
                    <ChevronsRightIcon class="group-hover:animate-pulse" />
                    <span>{m.garmin_mfa_confirm()}</span>
                </button>
            </footer>
    </form>
{/if}
