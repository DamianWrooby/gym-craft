<script lang="ts">
    import Logo from '$lib/images/gym-craft-logo-crop.png';
    import { page } from '$app/stores';
    import { Edit2Icon } from 'svelte-feather-icons';

    const user = $page.data.user;
</script>

<div class="h-full flex items-center justify-center">
    <div class="card p-16">
        <section class="p-5 pt-10">
            <h1 class="h1 text-2xl text-center font-bold">
                <span>Welcome to</span>
            </h1>
            <img class="m-auto py-5" src={Logo} alt="Gym Craft Logo" />
            <h2 class="h1 text-lg text-center">
                <span>Your AI powered personal trainer</span>
            </h2>
        </section>
        <section class="p-5 text-center">
            {#if user}
                <a href="/survey" class="btn variant-filled-primary group">
                    <Edit2Icon size="20" class="group-hover:animate-pulse" />
                    <span>Fill the survey</span>
                </a>
            {:else}
                <a href="/login" class="btn variant-filled-primary group">
                    <span>Log in</span>
                </a>
            {/if}
        </section>
    </div>
</div>
