<script lang="ts">
    import { m } from '$lib/paraglide/messages.js';
    import { Avatar, getModalStore, type ModalSettings } from '@skeletonlabs/skeleton';
    import { page } from '$app/stores';
    import type { User } from '@/models/user/user.model';
    import SportIcon from '@components/sport-icon/SportIcon.svelte';
    import { CalendarIcon, LogOutIcon } from 'svelte-feather-icons';

    export let user: User;

    $: firstLetter = user?.name[0].toUpperCase();
    $: isActive = (path: string) => $page.url.pathname.startsWith(path);

    const modalStore = getModalStore();
    let logoutForm: HTMLFormElement;

    function confirmLogout() {
        const modal: ModalSettings = {
            type: 'confirm',
            title: m.nav_logout(),
            body: m.nav_logout_confirm(),
            buttonTextConfirm: m.nav_logout(),
            response: (confirmed: boolean) => {
                // form.submit() skips the submit event, so this does not re-open the modal.
                if (confirmed) logoutForm.submit();
            },
        };
        modalStore.trigger(modal);
    }
</script>

<nav class="flex items-center text-surface-500 font-semibold whitespace-nowrap">
    {#if !user}
        <a class="px-4 hover:text-tertiary-500" class:text-tertiary-500={isActive('/app/login')} href="/app/login"
            >{m.nav_login()}</a>
        <a class="px-4 hover:text-tertiary-500" class:text-tertiary-500={isActive('/app/register')} href="/app/register"
            >{m.nav_register()}</a>
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
            class="px-2 sm:px-4 hover:text-tertiary-500 flex items-center gap-1.5"
            class:text-tertiary-500={isActive('/app/plan')}
            href="/app/plan">
            <CalendarIcon size="18" />
            <span class="hidden sm:inline">{m.nav_plan()}</span>
        </a>
        <a
            class="px-2 sm:px-4 hover:text-tertiary-500 flex items-center gap-1.5"
            class:text-tertiary-500={isActive('/app/gym')}
            href="/app/gym">
            <SportIcon sport="gym" size={18} />
            <span class="hidden sm:inline">{m.nav_gym()}</span>
        </a>
        <a
            class="px-2 sm:px-4 hover:text-tertiary-500 flex items-center gap-1.5"
            class:text-tertiary-500={isActive('/app/running')}
            href="/app/running">
            <SportIcon sport="running" size={18} />
            <span class="hidden sm:inline">{m.nav_running()}</span>
        </a>
        <span class="hidden sm:block text-surface-300 select-none">|</span>
        <form action="/app/logout" method="POST" bind:this={logoutForm} on:submit|preventDefault={confirmLogout}>
            <!-- Icon-only on phones, where the full label pushes the bar past the screen edge. -->
            <button
                class="px-2 sm:px-4 hover:text-tertiary-500 flex items-center"
                type="submit"
                title={m.nav_logout()}
                aria-label={m.nav_logout()}>
                <LogOutIcon size="18" class="sm:hidden" />
                <span class="hidden sm:inline">{m.nav_logout()}</span>
            </button>
        </form>
    {/if}
</nav>
