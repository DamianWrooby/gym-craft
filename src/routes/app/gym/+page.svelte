<script lang="ts">
    import { CalendarIcon, ArrowRightIcon } from 'svelte-feather-icons';
    import Card from '@components/card/Card.svelte';
    import SportIcon from '@components/sport-icon/SportIcon.svelte';
    import Seo from '$lib/components/seo/Seo.svelte';
</script>

<Seo title="Gym | GymCraft™" metaDescription="Gym hub — strength sessions now live in your training plan." />

<Card width="3/4">
    <div class="flex flex-col items-center text-center gap-3 pb-8">
        <span class="text-tertiary-500">
            <SportIcon sport="gym" size={48} />
        </span>
        <h2 class="h2 text-2xl md:text-3xl">Gym</h2>
        <p class="text-surface-500 dark:text-surface-300 max-w-xl">
            Strength sessions now live in your training plan, on the same calendar as your runs.
        </p>
    </div>

    <div class="md:w-1/2 m-auto pb-4">
        <a
            href="/app/plan"
            data-sveltekit-preload-data="hover"
            class="group card variant-soft-surface hover:variant-soft-tertiary transition-colors p-6 flex flex-col gap-3 no-underline">
            <div class="flex items-center justify-between">
                <span class="text-tertiary-500 group-hover:text-tertiary-400">
                    <CalendarIcon size="28" />
                </span>
                <ArrowRightIcon size="20" class="opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <h3 class="h3 text-lg font-semibold">Open my plan</h3>
            <p class="text-sm text-surface-500 dark:text-surface-300">
                See this week's strength and running sessions, day by day.
            </p>
        </a>
    </div>
</Card>
