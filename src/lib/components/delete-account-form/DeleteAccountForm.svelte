<script lang="ts">
    import Spinner from '@components/loading/spinner/Spinner.svelte';

    export let onSubmit = () => {};
    export let data: { password: string };
    export let loading = false;
</script>

<div class="flex flex-col gap-3 w-full max-w-sm">
    <label class="label" for="delete-account-password">Enter your password to delete your account</label>
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
        <span>Confirm deletion</span>
    </button>
</div>
