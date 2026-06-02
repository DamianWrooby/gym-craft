<script lang="ts">
    import { BarChart2Icon, ArrowRightIcon, RefreshCwIcon, CheckCircleIcon } from 'svelte-feather-icons';
    import { page } from '$app/stores';
    import { getModalStore, getToastStore } from '@skeletonlabs/skeleton';
    import type { ModalComponent, ModalSettings } from '@skeletonlabs/skeleton';
    import Card from '@components/card/Card.svelte';
    import SportIcon from '@components/sport-icon/SportIcon.svelte';
    import Seo from '$lib/components/seo/Seo.svelte';
    import GarminLoginForm from '$lib/components/garmin-login-form/GarminLoginForm.svelte';
    import { makeToast } from '$lib/utils/toasts';
    import { validateGarminLoginFormData } from '$lib/utils/form-validation';

    export let data: {
        garminConnected: boolean;
        syncState: { backfillComplete: boolean; lastSyncedAt: string | null; oldestActivityAt: string | null } | null;
    };

    const modalStore = getModalStore();
    const toastStore = getToastStore();
    const modalComponent: ModalComponent = { ref: GarminLoginForm };

    type LoginFormData = { email: string; password: string };

    let syncing = false;
    let syncError: string | null = null;
    let syncMessage: string | null = null;

    $: backfillNeeded = data.garminConnected && (!data.syncState || !data.syncState.backfillComplete);
    $: lastSyncedLabel = data.syncState?.lastSyncedAt ? formatRelative(data.syncState.lastSyncedAt) : null;

    function formatRelative(iso: string): string {
        const then = new Date(iso).getTime();
        const diffMin = Math.round((Date.now() - then) / 60000);
        if (diffMin < 1) return 'just now';
        if (diffMin < 60) return `${diffMin} min ago`;
        const diffHr = Math.round(diffMin / 60);
        if (diffHr < 24) return `${diffHr}h ago`;
        const diffDay = Math.round(diffHr / 24);
        return `${diffDay}d ago`;
    }

    async function runSync(password?: string) {
        syncing = true;
        syncError = null;
        syncMessage = null;
        try {
            const res = await fetch(`/api/user/${$page.data.user?.id ?? ''}/garmin/sync`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(password ? { password } : {}),
            });
            const payload = await res.json();
            if (!res.ok) {
                if (isInvalidTokenError(payload)) {
                    makeToast(
                        toastStore,
                        'Invalid token <br> Please log in to your Garmin account',
                        'variant-filled-warning',
                    );
                    openGarminLoginModal();
                    return;
                }
                syncError = payload?.message ?? 'Sync failed';
            } else {
                syncMessage = `Imported ${payload?.data?.activitiesUpserted ?? 0} activities (${payload?.data?.mode ?? 'sync'}).`;
                await new Promise((r) => setTimeout(r, 600));
                location.reload();
            }
        } catch (err) {
            syncError = err instanceof Error ? err.message : 'Sync failed';
        } finally {
            syncing = false;
        }
    }

    function isInvalidTokenError(payload: { code?: string; message?: string }): boolean {
        return payload?.code === 'INVALID_TOKEN' || !!payload?.message?.includes('No valid token found');
    }

    function openGarminLoginModal() {
        const modal: ModalSettings = {
            type: 'component',
            title: 'Sign in to Garmin Connect',
            body: 'Provide credentials to connect to your Garmin Connect account and sync your activities.',
            buttonTextCancel: 'Cancel',
            buttonTextConfirm: 'Login and sync',
            component: modalComponent,
            response: handleGarminLogin,
        };
        modalStore.trigger(modal);
    }

    function handleGarminLogin(loginFormData: LoginFormData | false) {
        if (!loginFormData) return;

        const formValidationError = validateGarminLoginFormData(loginFormData);
        if (formValidationError) {
            makeToast(toastStore, 'Form validation error', 'variant-filled-error');
            return;
        }

        runSync(loginFormData.password);
    }
</script>

<Seo title="Running | GymCraft™" metaDescription="Running hub — review your activity analytics from Garmin Connect." />

<Card width="3/4">
    <div class="flex flex-col items-center text-center gap-3 pb-8">
        <span class="text-tertiary-500">
            <SportIcon sport="running" size={48} />
        </span>
        <h2 class="h2 text-2xl md:text-3xl">Running</h2>
        <p class="text-surface-500 dark:text-surface-300 max-w-xl">
            Review your training activity synced from Garmin Connect. More running tools are coming soon.
        </p>
    </div>

    {#if data.garminConnected}
        <div class="md:w-3/4 m-auto pb-6">
            {#if backfillNeeded}
                <aside class="card variant-soft-warning p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                    <div class="flex-1">
                        <p class="font-semibold">Import your Garmin history</p>
                        <p class="text-sm opacity-80">
                            We'll fetch your last 90 days of activities so training-load analytics can work. This runs
                            once and takes a few seconds.
                        </p>
                    </div>
                    <button class="btn variant-filled-warning" on:click={() => runSync()} disabled={syncing}>
                        <RefreshCwIcon size="16" class={syncing ? 'animate-spin' : ''} />
                        <span>{syncing ? 'Importing…' : 'Import now'}</span>
                    </button>
                </aside>
            {:else if data.syncState}
                <aside class="card variant-soft-surface p-3 flex items-center gap-3 text-sm">
                    <CheckCircleIcon size="18" class="text-success-500" />
                    <span class="flex-1">
                        Synced{lastSyncedLabel ? ` ${lastSyncedLabel}` : ''}. Training history ready.
                    </span>
                    <button class="btn btn-sm variant-ghost-surface" on:click={() => runSync()} disabled={syncing}>
                        <RefreshCwIcon size="14" class={syncing ? 'animate-spin' : ''} />
                        <span>{syncing ? 'Syncing…' : 'Refresh'}</span>
                    </button>
                </aside>
            {/if}
            {#if syncError}
                <p class="text-error-500 text-sm mt-2">{syncError}</p>
            {/if}
            {#if syncMessage}
                <p class="text-success-500 text-sm mt-2">{syncMessage}</p>
            {/if}
        </div>
    {/if}

    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 md:w-3/4 m-auto pb-4">
        <a
            href="/app/running/analytics"
            data-sveltekit-preload-data="hover"
            class="group card variant-soft-surface hover:variant-soft-tertiary transition-colors p-6 flex flex-col gap-3 no-underline">
            <div class="flex items-center justify-between">
                <span class="text-tertiary-500 group-hover:text-tertiary-400">
                    <BarChart2Icon size="28" />
                </span>
                <ArrowRightIcon size="20" class="opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <h3 class="h3 text-lg font-semibold">Analytics</h3>
            <p class="text-sm text-surface-500 dark:text-surface-300">
                Browse your Garmin activities — pace, distance, and trends over time.
            </p>
        </a>
    </div>
</Card>
