<script lang="ts">
    import { page } from '$app/stores';

    const user = $page.data.user;
</script>

<nav class="flex text-surface-500 font-semibold whitespace-nowrap">
    {#if !user}
        <a class="px-4 hover:text-tertiary-500" href="/login">Login</a>
        <a class="px-4 hover:text-tertiary-500" href="/register">Register</a>
    {:else}
        <span class="hidden md:block font-normal text-tertiary-500">Logged in as {user.name}</span>
        <a class="px-4 hover:text-tertiary-500" href="/my-plans">My plans</a>

        <form action="/logout" method="POST">
            <button class="hover:text-tertiary-500" type="submit">Log out</button>
        </form>
    {/if}
</nav>
