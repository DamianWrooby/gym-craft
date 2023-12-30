<script lang="ts">
    import '../app.pcss';
    import { AppShell, AppBar, LightSwitch } from '@skeletonlabs/skeleton';
    import { initializeStores } from '@skeletonlabs/skeleton';
    import { Modal } from '@skeletonlabs/skeleton';
    import { HomeIcon } from 'svelte-feather-icons';
    import Navigation from '@components/navigation/Navigation.svelte';

    const currentDate = new Date();
    initializeStores();
</script>

<svelte:head>
    <title>Gym Craft - Personal trainer powered by AI</title>
</svelte:head>

<Modal />

<AppShell>
    <svelte:fragment slot="header">
        <AppBar background="bg-primary-500">
            <svelte:fragment slot="lead">
                <a class="px-4 text-surface-500 hover:text-tertiary-500" href="/"
                    ><HomeIcon></HomeIcon></a>
            </svelte:fragment>
            <svelte:fragment slot="trail">
                <Navigation></Navigation>
                <LightSwitch></LightSwitch>
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
