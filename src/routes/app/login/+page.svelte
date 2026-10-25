<script lang="ts">
    import { m } from '$lib/paraglide/messages.js';
    import { enhance, applyAction } from '$app/forms';
    import { makeToast } from '$lib/utils/toasts.js';
    import { getToastStore } from '@skeletonlabs/skeleton';
    import Card from '@components/card/Card.svelte';
    import Spinner from '@components/loading/spinner/Spinner.svelte';
    import type { ActionResult } from '@sveltejs/kit';

    export let form;

    const toastStore = getToastStore();
    let loading = false;

    interface FormCallbackResult {
        result: ActionResult;
        update: () => void;
    }
    type FormCallback = () => (result: FormCallbackResult) => Promise<void>;
    const formCallback: FormCallback = () => {
        loading = true;
        return async ({ result }) => {
            await applyAction(result);
            if (result.type === 'redirect') {
                setTimeout(() => {
                    makeToast(toastStore, m.login_success(), 'variant-filled-success');
                }, 2000);
            } else if (result.type === 'error') {
                setTimeout(() => {
                    makeToast(toastStore, m.common_server_error(), 'variant-filled-error');
                }, 2000);
            }
            loading = false;
        };
    };
</script>

<Card width="1/4">
    <section class="grow flex flex-col justify-center">
        <h1 class="h1 text-2xl text-center font-bold">
            <span>{m.login_heading()}</span>
        </h1>
        <p class="pb-8 text-center">{m.login_subheading()}</p>
        <form action="?/login" method="POST" use:enhance={formCallback}>
            <div class="p-1 max-w-sm m-auto">
                <label class="label" for="username">{m.auth_username()}</label>
                <input class="input" id="username" name="username" type="text" autocomplete="username" required />
            </div>

            <div class="p-1 max-w-sm m-auto pb-5">
                <label class="label" for="password">{m.auth_password()}</label>
                <input
                    class="input"
                    id="password"
                    name="password"
                    type="password"
                    autocomplete="current-password"
                    required />
            </div>

            {#if form?.invalid}
                <p class="text-center text-primary-500 pb-5">{m.login_missing_fields()}</p>
            {/if}

            {#if form?.credentials}
                <p class="text-center text-primary-500 pb-5">{m.login_wrong_credentials()}</p>
            {/if}

            <div class="text-center">
                <button class="btn variant-filled-primary" type="submit" disabled={loading}>
                    {#if loading}
                        <Spinner size={4} />
                    {/if}
                    <span>{m.login_submit()}</span>
                </button>
            </div>

            <p class="pt-5 text-center">
                {m.login_no_account()}
                <a class="text-primary-500 hover:text-primary-700" href="/app/register">{m.nav_register()}</a>
            </p>
        </form>
    </section>
</Card>
