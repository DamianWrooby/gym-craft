<script lang="ts">
    export let form;
</script>

<section class="w-full h-full flex flex-col">
    <h1 class="p-3">Register</h1>
    <div class="grow py-8 flex justify-center">
        <form action="?/register" method="POST">
            <div class="p-1">
                <label class="label" for="username">Username</label>
                <input class="input" id="username" name="username" type="text" required />
            </div>

            <div class="p-1">
                <label class="label" for="password">Password</label>
                <input class="input" id="password" name="password" type="password" required />
            </div>

            <div class="p-1">
                <label class="label" for="confirmPassword">Confirm password</label>
                <input
                    class="input"
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    required
                />
            </div>

            {#if form?.user}
                <p class="error">Username is taken.</p>
            {/if}

            {#if form?.passwords}
                <p class="text-primary-500 pb-2">Passwords do not match.</p>
            {/if}

            <button class="btn variant-filled-primary" type="submit">Register</button>
        </form>
    </div>
</section>
