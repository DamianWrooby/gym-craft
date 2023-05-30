<script lang="ts">
    import { page } from '$app/stores';

    const user = $page.data.user;
    let isActive = {
        login: false,
        register: false,
        admin: false,
    };
</script>

<nav class="flex text-surface-500 font-semibold">
    {#if !user}
        <a
            class={isActive.login ? 'px-4 text-tertiary-500' : 'px-4'}
            on:mouseover={() => (isActive.login = true)}
            on:mouseout={() => (isActive.login = false)}
            href="/login">Login</a
        >
        <a
            class={isActive.register ? 'px-4 text-tertiary-500' : 'px-4'}
            on:mouseover={() => (isActive.register = true)}
            on:mouseout={() => (isActive.register = false)}
            href="/register">Register</a
        >
    {:else}
        <a
            class={isActive.admin ? 'px-4 text-tertiary-500' : 'px-4'}
            on:mouseover={() => (isActive.admin = true)}
            on:mouseout={() => (isActive.admin = false)}
            href="/admin">Admin</a
        >

        <form action="/logout" method="POST">
            <button type="submit">Log out</button>
        </form>
    {/if}
</nav>
