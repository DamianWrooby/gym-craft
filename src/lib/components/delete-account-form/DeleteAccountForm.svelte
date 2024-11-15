<script lang="ts">
    import Spinner from '@components/loading/spinner/Spinner.svelte';

    export let onSubmit = () => {};
    export let data: { password: string };
    export let loading = false;
</script>

<div class="flex flex-col justify-end p-8 w-9/12">
    <label class="label pb-2 grow">
        <div>Enter your password to delete your account</div>
        <input class="input" id="password" name="password" type="password" bind:value={data.password} required />
    </label>
    <button type="button" class="btn variant-filled-error mx-auto" disabled={loading} on:click={onSubmit}>
        {#if loading}
            <Spinner size={4} />
        {/if}
        <span>Confirm</span>
    </button>
</div>
