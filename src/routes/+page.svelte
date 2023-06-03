<script lang="ts">
    import { page } from '$app/stores';
    import { Edit2Icon } from 'svelte-feather-icons';

    const user = $page.data.user;
</script>

<div class="flex flex-col md:flex-row">
    <div class="basis-full md:basis-1/2">
        <section class="p-5 pt-20 flex flex-col justify-items-center">
            <h1 class="h1 text-5xl text-center">
                <span
                    class="bg-gradient-to-br from-primary-500 to-surface-500 bg-clip-text text-transparent box-decoration-clone font-extrabold">
                    GYM CRAFT
                </span>
            </h1>
            <p
                class="text-center top-15 bg-gradient-to-br from-primary-500 to-primary-300 bg-clip-text text-transparent box-decoration-clone font-bold text-lg">
                Your AI powered personal trainer
            </p>
        </section>
    </div>
    <div class="basis-full md:basis-1/2 flex justify-center py-24">
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
    </div>
</div>
