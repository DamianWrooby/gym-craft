<script lang="ts">
    import { m } from '$lib/paraglide/messages.js';
    import Spinner from '@components/loading/spinner/Spinner.svelte';

    export let onSubmit = () => {};
    export let data: { password: string };
    export let loading = false;
</script>

<div class="flex flex-col gap-3 w-full max-w-sm">
    <label class="label" for="delete-account-password">{m.account_delete_password()}</label>
    <input
        class="input"
        id="delete-account-password"
        name="password"
        type="password"
        autocomplete="current-password"
        bind:value={data.password}
        required />
    <button type="button" class="btn variant-filled-error self-start" disabled={loading} on:click={onSubmit}>
        {#if loading}
            <Spinner size={4} />
        {/if}
        <span>{m.account_delete_confirm()}</span>
    </button>
</div>
