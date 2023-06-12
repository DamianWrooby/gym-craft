<script lang="ts">
    export let form;
</script>

<div class="h-full flex items-center justify-center">
    <div class="card p-16 min-w-[30%]">
        <section class="grow flex flex-col justify-center">
            <h1 class="h1 text-2xl text-center font-bold">
                <span>Hello!</span>
            </h1>
            <p class="pb-8 text-center">Sign in to your account</p>
            <form action="?/login" method="POST">
                <div class="p-1">
                    <label class="label" for="username">Username</label>
                    <input class="input" id="username" name="username" type="text" required />
                </div>

                <div class="p-1 pb-5">
                    <label class="label" for="password">Password</label>
                    <input class="input" id="password" name="password" type="password" required />
                </div>

                {#if form?.invalid}
                    <p class="text-primary-500 pb-5">Username and password are required.</p>
                {/if}

                {#if form?.credentials}
                    <p class="text-primary-500 pb-5">You have entered the wrong credentials.</p>
                {/if}

                <div class="text-center">
                    <button class="btn variant-filled-primary" type="submit">Log in</button>
                </div>

                <p class="pt-5 text-center">
                    Don't have an account? <a
                        class="text-primary-500 hover:text-primary-700"
                        href="/register">Register.</a>
                </p>
            </form>
        </section>
    </div>
</div>
