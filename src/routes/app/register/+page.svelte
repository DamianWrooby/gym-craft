<script lang="ts">
    import { enhance, applyAction } from '$app/forms';
    import { loadingState } from '@/stores';
    import { debounce } from 'lodash';
    import { validatePasswordComplexity } from '$lib/utils/form-validation.js';
    import { getToastStore } from '@skeletonlabs/skeleton';
    import { makeToast } from '$lib/utils/toasts.js';
    import Card from '@components/card/Card.svelte';
    import { ActionResult } from '@sveltejs/kit';

    export let form;

    const toastStore = getToastStore();

    let formData = {
        username: '',
        email: '',
        password: '',
        confirmPassword: '',
        termsOfUse: false,
        marketingAgreement: false,
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
            if (!!formData.username && !!formData.password && !!formData.confirmPassword && !!formData.email) {
                isFormFilled = true;
            }
        }, 1200)();
    }

    interface FormCallbackResult {
        result: ActionResult;
        update: () => void;
    }
    type FormCallback = () => (result: FormCallbackResult) => Promise<void>;
    const formCallback: FormCallback = () => {
        loadingState.set(true);
        return async ({ result }) => {
            await applyAction(result);
            loadingState.set(false);
            if (result.type === 'redirect') {
                makeToast(toastStore, 'Your account has been created. Now you can sign in.', 'variant-filled-success');
            } else if (result.type === 'error') {
                makeToast(
                    toastStore,
                    result.error?.message || 'Server error. Please try again.',
                    'variant-filled-error',
                );
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
            <div class="p-1 max-w-sm m-auto">
                <label class="label" for="username">Username</label>
                <input
                    class="input"
                    id="username"
                    name="username"
                    type="text"
                    autocomplete="username"
                    bind:value={formData.username}
                    required />
                {#if form?.userExists}
                    <p class="text-error-500">Username is taken.</p>
                {/if}
            </div>

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
                {#if form?.emailInvalid}
                    <p class="text-error-500">Invalid email address</p>
                {:else if form?.emailExists}
                    <p class="text-error-500">Email is already in use.</p>
                {/if}
            </div>

            <div class="p-1 max-w-sm m-auto">
                <label class="label" for="password">Password</label>
                <input
                    class="input"
                    id="password"
                    name="password"
                    type="password"
                    autocomplete="new-password"
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

            <div class="p-1 max-w-sm m-auto">
                <label class="label" for="confirmPassword">Confirm password</label>
                <input
                    class="input"
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    autocomplete="new-password"
                    bind:value={formData.confirmPassword}
                    on:input={onInput}
                    required />
            </div>

            <div class="px-1 pt-5 max-w-sm m-auto">
                <label class="flex items-center space-x-2">
                    <input
                        class="checkbox required:border-red-500"
                        id="termsOfUse"
                        name="termsOfUse"
                        type="checkbox"
                        required
                        bind:checked={formData.termsOfUse}
                        on:input={onInput} />
                    <p>
                        I agree to the <a class="text-primary-500 hover:text-primary-700" href="/terms-of-use"
                            >Terms of Use</a>
                        and <a class="text-primary-500 hover:text-primary-700" href="/privacy-policy">Privacy Policy</a>
                        (required)
                    </p>
                </label>
            </div>
            {#if form?.termsOfUse}
                <p class="text-error-500">You must accept the terms of use to proceed</p>
            {/if}
            <div class="px-1 py-2 max-w-sm m-auto">
                <label class="flex items-center space-x-2">
                    <input
                        class="checkbox"
                        id="marketingAgreement"
                        name="marketingAgreement"
                        type="checkbox"
                        bind:checked={formData.marketingAgreement} />
                    <p>
                        I agree to receive by email information related to the development of the GymCraft application
                        (optional)
                    </p>
                </label>
            </div>
            {#if form?.invalidEntry}
                <p class="text-error-500">One of the fields has incorrect value</p>
            {:else if isFormDirty && !isFormValid && isFormFilled}
                <p class="text-error-500 pb-2 w-72 max-w-sm m-auto">
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
