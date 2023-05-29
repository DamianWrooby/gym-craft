<script lang="ts">
    export let form;
</script>

<section class="w-full h-full flex flex-col">
    <h1 class="p-3">Login</h1>
    <div class="grow py-8 flex justify-center">
        <form action="?/login" method="POST">
            <div class="p-1">
                <label class="label" for="username">Username</label>
                <input class="input" id="username" name="username" type="text" required />
            </div>

            <div class="p-1">
                <label class="label" for="password">Password</label>
                <input class="input" id="password" name="password" type="password" required />
            </div>

            {#if form?.invalid}
                <p class="text-primary-500 pb-2">Username and password is required.</p>
            {/if}

            {#if form?.credentials}
                <p class="text-primary-500 pb-2">You have entered the wrong credentials.</p>
            {/if}

            <button class="btn variant-filled-primary" type="submit">Log in</button>
        </form>
    </div>
</section>
