<script lang="ts">
    import { debounce } from 'lodash';
    import { validatePasswordComplexity } from '$lib/utils/formValidation.js';
    export let form;

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
</script>

<div class="h-full flex items-center justify-center">
    <div class="card p-16 min-w-[30%]">
        <section class="grow flex flex-col justify-center">
            <h1 class="h1 text-2xl text-center font-bold">
                <span>Welcome to Gym Craft!</span>
            </h1>
            <p class="pb-8 text-center">Create your account</p>
            <form action="?/register" method="POST">
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
                            Password should have at least 8 characters and contain upper and lower
                            case, numeric, and special character.
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
                        Password should have at least 8 characters and contain upper and lower case,
                        numeric, and special character. Passwords should match.
                    </p>
                {/if}

                <div class="text-center pt-5">
                    <button
                        class="btn variant-filled-primary"
                        type="submit"
                        disabled={!isFormValid || !isFormFilled}>Register</button>
                </div>
            </form>
        </section>
    </div>
</div>
