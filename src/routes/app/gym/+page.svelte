<script lang="ts">
    import { Edit2Icon, ListIcon, ArrowRightIcon } from 'svelte-feather-icons';
    import Card from '@components/card/Card.svelte';
    import SportIcon from '@components/sport-icon/SportIcon.svelte';
    import Seo from '$lib/components/seo/Seo.svelte';
</script>

<Seo title="Gym | GymCraft™" metaDescription="Gym workouts hub — create AI plans and browse your saved workouts." />

<Card width="3/4">
    <div class="flex flex-col items-center text-center gap-3 pb-8">
        <span class="text-tertiary-500">
            <SportIcon sport="gym" size={48} />
        </span>
        <h2 class="h2 text-2xl md:text-3xl">Gym</h2>
        <p class="text-surface-500 dark:text-surface-300 max-w-xl">
            Generate AI-powered strength training plans tailored to your goals and review the workouts you've already
            created.
        </p>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 md:w-3/4 m-auto pb-4">
        <a
            href="/app/gym/create-plan"
            data-sveltekit-preload-data="hover"
            class="group card variant-soft-surface hover:variant-soft-tertiary transition-colors p-6 flex flex-col gap-3 no-underline">
            <div class="flex items-center justify-between">
                <span class="text-tertiary-500 group-hover:text-tertiary-400">
                    <Edit2Icon size="28" />
                </span>
                <ArrowRightIcon size="20" class="opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <h3 class="h3 text-lg font-semibold">Create plan</h3>
            <p class="text-sm text-surface-500 dark:text-surface-300">
                Answer a few questions and let AI build a personalized training plan.
            </p>
        </a>

        <a
            href="/app/gym/my-plans"
            data-sveltekit-preload-data="hover"
            class="group card variant-soft-surface hover:variant-soft-tertiary transition-colors p-6 flex flex-col gap-3 no-underline">
            <div class="flex items-center justify-between">
                <span class="text-tertiary-500 group-hover:text-tertiary-400">
                    <ListIcon size="28" />
                </span>
                <ArrowRightIcon size="20" class="opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <h3 class="h3 text-lg font-semibold">My plans</h3>
            <p class="text-sm text-surface-500 dark:text-surface-300">
                Browse, rename, download or sync the plans you've created.
            </p>
        </a>
    </div>
</Card>
