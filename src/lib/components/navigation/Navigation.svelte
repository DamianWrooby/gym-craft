<script lang="ts">
    import { Avatar } from '@skeletonlabs/skeleton';
    import { page } from '$app/stores';
    import type { User } from '@/models/user/user.model';
    import SportIcon from '@components/sport-icon/SportIcon.svelte';

    export let user: User;

    $: firstLetter = user?.name[0].toUpperCase();
    $: isActive = (path: string) => $page.url.pathname.startsWith(path);
</script>

<nav class="flex items-center text-surface-500 font-semibold whitespace-nowrap">
    {#if !user}
        <a class="px-4 hover:text-tertiary-500" class:text-tertiary-500={isActive('/app/login')} href="/app/login"
            >Login</a>
        <a class="px-4 hover:text-tertiary-500" class:text-tertiary-500={isActive('/app/register')} href="/app/register"
            >Register</a>
    {:else}
        <a
            class="px-2 sm:px-4 hover:text-tertiary-500"
            class:!border-tertiary-500={isActive('/app/my-account')}
            href="/app/my-account"
            data-sveltekit-reload>
            <Avatar
                initials={firstLetter}
                background="bg-tertiary-900"
                border="border-2 border-surface-300-600-token hover:!border-tertiary-500"
                width="w-8" />
        </a>
        <a
            class="px-3 sm:px-4 hover:text-tertiary-500 flex items-center gap-1.5"
            class:text-tertiary-500={isActive('/app/gym')}
            href="/app/gym">
            <SportIcon sport="gym" size={18} />
            <span class="hidden sm:inline">Gym</span>
        </a>
        <a
            class="px-3 sm:px-4 hover:text-tertiary-500 flex items-center gap-1.5"
            class:text-tertiary-500={isActive('/app/running')}
            href="/app/running">
            <SportIcon sport="running" size={18} />
            <span class="hidden sm:inline">Running</span>
        </a>
        <span class="hidden sm:block text-surface-300 select-none">|</span>
        <form action="/app/logout" method="POST">
            <button class="px-2 sm:px-4 hover:text-tertiary-500" type="submit">Log out</button>
        </form>
    {/if}
</nav>
