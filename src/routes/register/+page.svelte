<script lang="ts">
    import { enhance, applyAction } from '$app/forms';
    import { loadingState } from '@/stores';
    import { debounce } from 'lodash';
    import { validatePasswordComplexity } from '$lib/utils/form-validation.js';
    import { getToastStore } from '@skeletonlabs/skeleton';
    import { makeToast } from '$lib/utils/toasts.js';
    import Card from '@components/card/Card.svelte';

    export let form;

    const toastStore = getToastStore();

    let formData = {
        username: '',
        password: '',
        confirmPassword: '',
    };

    let isFormValid = false;
    let isFormDirty = false;
    let isFormFilled = false;

    function validateForm() {
        isFormValid =
            validatePasswordComplexity(formData.password) &&
            formData.password === formData.confirmPassword &&
            !!formData.username;
    }

    function onInput() {
        debounce(() => {
            validateForm();
            isFormDirty = true;
            if (!!formData.username && !!formData.password && !!formData.confirmPassword) {
                isFormFilled = true;
            }
        }, 1500)();
    }

    interface FormCallbackResult {
        result: any;
        update: () => void;
    }
    type FormCallback = () => (result: FormCallbackResult) => Promise<void>;
    const formCallback: FormCallback = () => {
        loadingState.set(true);
        return async ({ result, update }) => {
            await applyAction(result);
            loadingState.set(false);
            if (result.type === 'redirect') {
                makeToast(toastStore, 'Your account has been created. Now you can sign in.', 'variant-filled-success');
            } else if (result.type === 'error') {
                makeToast(toastStore, result.message, 'variant-filled-error');
            }
        };
    };
</script>

<Card width="1/4">
    <section class="grow flex flex-col justify-center">
        <h1 class="h1 text-2xl text-center font-bold">
            <span>Welcome to Gym Craft!</span>
        </h1>
        <p class="pb-8 text-center">Create your account</p>
        <form action="?/register" method="POST" use:enhance={formCallback}>
            <div class="p-1">
                <label class="label" for="username">Username</label>
                <input
                    class="input"
                    id="username"
                    name="username"
                    type="text"
                    bind:value={formData.username}
                    required />
                {#if form?.userExists}
                    <p class="text-error-500">Username is taken.</p>
                {/if}
            </div>

            <div class="p-1">
                <label class="label" for="password">Password</label>
                <input
                    class="input"
                    id="password"
                    name="password"
                    type="password"
                    bind:value={formData.password}
                    on:input={onInput}
                    required />
                {#if form?.passwordComplexity}
                    <p class="text-error-500">
                        Password should have at least 8 characters and contain upper and lower case, numeric, and
                        special character.
                    </p>
                {:else if form?.passwordsExact}
                    <p class="text-primary-500 pb-2">Passwords do not match.</p>
                {/if}
            </div>

            <div class="p-1">
                <label class="label" for="confirmPassword">Confirm password</label>
                <input
                    class="input"
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    bind:value={formData.confirmPassword}
                    on:input={onInput}
                    required />
            </div>
            {#if form?.invalidEntry}
                <p class="text-error-500">One of the fields has incorrect value</p>
            {:else if isFormDirty && !isFormValid && isFormFilled}
                <p class="text-error-500 pb-2 w-72">
                    Password should have at least 8 characters and contain upper and lower case, numeric, and special
                    character. Passwords should match.
                </p>
            {/if}

            <div class="text-center pt-5">
                <button
                    class="btn variant-filled-primary"
                    type="submit"
                    disabled={!isFormValid || !isFormFilled || $loadingState}>Register</button>
            </div>
        </form>
    </section>
</Card>
