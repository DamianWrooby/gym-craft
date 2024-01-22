<script lang="ts">
    import { page } from '$app/stores';
    import { Avatar } from '@skeletonlabs/skeleton';

    const user = $page.data.user;
    const firstLetter = user?.name[0].toUpperCase();
</script>

<nav class="flex items-center text-surface-500 font-semibold whitespace-nowrap">
    {#if !user}
        <a class="px-4 hover:text-tertiary-500" href="/login">Login</a>
        <a class="px-4 hover:text-tertiary-500" href="/register">Register</a>
    {:else}
        <a class="px-4 hover:text-tertiary-500" href="/my-account">
            <Avatar
                initials={firstLetter}
                background="bg-tertiary-900"
                border="border-2 border-surface-300-600-token hover:!border-tertiary-500"
                width="w-8" />
        </a>
        <a class="px-4 hover:text-tertiary-500" href="/my-plans">My plans</a>

        <form action="/logout" method="POST">
            <button class="hover:text-tertiary-500" type="submit">Log out</button>
        </form>
    {/if}
</nav>
