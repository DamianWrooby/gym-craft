<script lang="ts">
    // The ordering of these imports is critical to your app working properly
    import '@skeletonlabs/skeleton/themes/theme-crimson.css';
    // If you have source.organizeImports set to true in VSCode, then it will auto change this ordering
    import '@skeletonlabs/skeleton/styles/skeleton.css';
    // Most of your app wide CSS should be put in this file
    import '../app.postcss';
    import { AppShell, AppBar, LightSwitch } from '@skeletonlabs/skeleton';
    import { HomeIcon } from 'svelte-feather-icons';
    import Navigation from '@components/navigation/Navigation.svelte';

    const currentDate = new Date();
</script>

<svelte:head>
    <title>Gym Craft - Personal trainer powered by AI</title>
</svelte:head>

<AppShell>
    <svelte:fragment slot="header">
        <AppBar background="bg-primary-500">
            <svelte:fragment slot="lead">
                <a class="px-4 text-surface-500 hover:text-tertiary-500" href="/"><HomeIcon /></a>
            </svelte:fragment>
            <svelte:fragment slot="trail">
                <Navigation />
                <LightSwitch />
            </svelte:fragment>
        </AppBar>
    </svelte:fragment>
    <!-- Router Slot -->
    <slot />
    <!-- ---- / ---- -->
    <svelte:fragment slot="footer">
        <div class="bg-primary-500 text-surface-500 text-center py-4 font-semibold">
            © {currentDate.getFullYear()} GYM CRAFT - Your AI powered personal trainer
        </div>
    </svelte:fragment>
</AppShell>
