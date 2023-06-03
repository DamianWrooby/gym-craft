<script lang="ts">
    import { page } from '$app/stores';

    const user = $page.data.user;
</script>

<nav class="flex text-surface-500 font-semibold">
    {#if !user}
        <a class="px-4 hover:text-tertiary-500" href="/login">Login</a>
        <a class="px-4 hover:text-tertiary-500" href="/register">Register</a>
    {:else}
        <a class="px-4 hover:text-tertiary-500" href="/my-plan">My plan</a>

        <form action="/logout" method="POST">
            <button type="submit">Log out</button>
        </form>
    {/if}
</nav>
