<script lang="ts">
    import { m } from '$lib/paraglide/messages.js';
    import { enhance, applyAction } from '$app/forms';
    import { loadingState } from '@/stores';
    import debounce from 'lodash/debounce';
    import { validatePasswordComplexity } from '$lib/utils/form-validation.js';
    import { getToastStore } from '@skeletonlabs/skeleton';
    import { makeToast } from '$lib/utils/toasts.js';
    import Card from '@components/card/Card.svelte';
    import Spinner from '@components/loading/spinner/Spinner.svelte';
    import type { ActionResult } from '@sveltejs/kit';

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

    $: isPasswordComplex = validatePasswordComplexity(formData.password);
    $: passwordsMatch = formData.password === formData.confirmPassword;

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
                makeToast(toastStore, m.register_success(), 'variant-filled-success');
            } else if (result.type === 'error') {
                makeToast(toastStore, result.error?.message || m.common_server_error(), 'variant-filled-error');
            }
        };
    };
</script>

<Card width="1/4">
    <section class="grow flex flex-col justify-center">
        <h1 class="h1 text-2xl text-center font-bold">
            <span>{m.register_heading()}</span>
        </h1>
        <p class="pb-8 text-center">{m.register_subheading()}</p>
        <form action="?/register" method="POST" use:enhance={formCallback}>
            <div class="p-1 max-w-sm m-auto">
                <label class="label" for="username">{m.auth_username()}</label>
                <input
                    class="input"
                    id="username"
                    name="username"
                    type="text"
                    autocomplete="username"
                    bind:value={formData.username}
                    required />
                {#if form?.accountExists}
                    <p class="text-error-500">{m.register_account_exists()}</p>
                {/if}
            </div>

            <div class="p-1 max-w-sm m-auto">
                <label class="label" for="email">{m.auth_email()}</label>
                <input
                    class="input"
                    id="email"
                    name="email"
                    type="email"
                    autocomplete="email"
                    bind:value={formData.email}
                    required />
                {#if form?.emailInvalid}
                    <p class="text-error-500">{m.register_email_invalid()}</p>
                {/if}
            </div>

            <div class="p-1 max-w-sm m-auto">
                <label class="label" for="password">{m.auth_password()}</label>
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
                        {m.register_password_rule()}
                    </p>
                {:else if form?.passwordsExact}
                    <p class="text-primary-500 pb-2">{m.register_passwords_mismatch()}</p>
                {/if}
            </div>

            <div class="p-1 max-w-sm m-auto">
                <label class="label" for="confirmPassword">{m.register_confirm_password()}</label>
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
                        {m.register_agree_to()}
                        <a class="text-primary-500 hover:text-primary-700" href="/terms-of-use"
                            >{m.register_terms_link()}</a>
                        {m.register_and()}
                        <a class="text-primary-500 hover:text-primary-700" href="/privacy-policy"
                            >{m.register_privacy_link()}</a>
                        {m.register_required()}
                    </p>
                </label>
            </div>
            {#if form?.termsOfUse}
                <p class="px-1 max-w-sm m-auto text-error-500">{m.register_terms_required()}</p>
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
                        {m.register_marketing_consent()}
                    </p>
                </label>
            </div>
            {#if form?.invalidEntry}
                <p class="px-1 pt-2 max-w-sm m-auto text-error-500" role="alert">
                    {m.register_invalid_entry()}
                </p>
            {:else if isFormDirty && !isFormValid && isFormFilled}
                <ul class="px-1 pt-2 max-w-sm m-auto text-error-500 text-sm space-y-1" role="alert">
                    {#if !isPasswordComplex}
                        <li>
                            {m.register_password_rule()}
                        </li>
                    {/if}
                    {#if !passwordsMatch}
                        <li>{m.register_passwords_mismatch()}</li>
                    {/if}
                </ul>
            {/if}

            <div class="text-center pt-5">
                <button
                    class="btn variant-filled-primary"
                    type="submit"
                    disabled={!isFormValid || !isFormFilled || $loadingState}>
                    {#if $loadingState}
                        <Spinner size={4} />
                    {/if}
                    <span>{m.nav_register()}</span>
                </button>
            </div>
        </form>
    </section>
</Card>
