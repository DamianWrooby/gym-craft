<script lang="ts">
    import { page } from '$app/stores';
    import { slide } from 'svelte/transition';
    import type { User } from '@/models/user/user.model';
    import DeleteAccountForm from '$lib/components/delete-account-form/DeleteAccountForm.svelte';
    import { getToastStore } from '@skeletonlabs/skeleton';
    import { makeToast } from '$lib/utils/toasts.js';
    import Card from '@components/card/Card.svelte';
    import { goto } from '$app/navigation';
    import { setCookie } from '$lib/utils/cookies';

    const user: User = $page.data.user;
    const formData = { password: '' };
    const toastStore = getToastStore();
    let deleteAccountFormOpened = false;
    let isDeletionProcessed = false;

    const openDeleteAccountPanel = () => {
        deleteAccountFormOpened = true;
    };

    const deleteAccount = async () => {
        isDeletionProcessed = true;

        const password = formData.password;
        const userId = user.id;

        try {
            const response: Response = await fetch(`/api/user`, {
                method: 'DELETE',
                body: JSON.stringify({
                    userId,
                    password,
                }),
            });
            const { message } = await response.json();

            if (response.ok) {
                makeToast(toastStore, message, 'variant-filled-success');
                setCookie('session', '', 0);
                goto('/app');
            } else {
                makeToast(toastStore, message, 'variant-filled-error');
            }
        } catch (err) {
            console.error({ err });
            makeToast(toastStore, 'Verification email has not been sent', 'variant-filled-error');
            makeToast(toastStore, err as string, 'variant-filled-error');
        }

        isDeletionProcessed = false;
    };
</script>

<Card>
    <h2 class="h2 text-center text-xl py-10">Manage your account</h2>
    <p>Name: <span class="text-secondary-400 font-bold">{user.name}</span></p>
    <p>Generated plans number: {user.generatedPlansNumber}</p>
    <p>Plans left: {user.plansLeft}</p>
    <div class="relative flex flex-col justify-center mt-8 border rounded border-solid border-red-500">
        <div class="absolute top-0">
            <p class="text-red-500 font-thin pl-1">Danger zone</p>
        </div>
        {#if !deleteAccountFormOpened}
            <div class="flex justify-center p-5">
                <button type="button" class="btn variant-filled-error" on:click={() => openDeleteAccountPanel()}>
                    <span>Delete my account</span>
                </button>
            </div>
        {:else}
            <section class="flex justify-center" transition:slide={{ duration: 200 }}>
                <DeleteAccountForm data={formData} onSubmit={() => deleteAccount()} loading={isDeletionProcessed} />
            </section>
        {/if}
    </div>
</Card>
