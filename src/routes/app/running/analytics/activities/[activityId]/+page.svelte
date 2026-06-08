<script lang="ts">
    import { afterNavigate, goto } from '$app/navigation';
    import { page } from '$app/stores';
    import { onMount } from 'svelte';
    import { getModalStore, getToastStore } from '@skeletonlabs/skeleton';
    import { ArrowLeftIcon } from 'svelte-feather-icons';
    import Card from '@components/card/Card.svelte';
    import Seo from '$lib/components/seo/Seo.svelte';
    import ActivityTypeIcon from '$lib/components/activity-type-icon/ActivityTypeIcon.svelte';
    import SplitsTable from '$lib/components/activity-detail/SplitsTable.svelte';
    import HrPaceOverlayChart from '$lib/components/activity-detail/HrPaceOverlayChart.svelte';
    import AskAiPanel from '$lib/components/activity-detail/AskAiPanel.svelte';
    import StatCard from '$lib/components/stat-card/StatCard.svelte';
    import { formatPaceOrSpeed } from '$lib/utils/pace';
    import { makeToast } from '$lib/utils/toasts.js';
    import { validateGarminLoginFormData } from '$lib/utils/form-validation';
    import { triggerGarminLoginModal, type GarminLoginResponse } from '$lib/garmin/garmin-login-modal';
    import { resolveBackTarget } from '$lib/utils/back-target';
    import type { User } from '@/models/user/user.model';

    export let data;

    const user: User = $page.data.user;
    const activity = data.activity;
    const modalStore = getModalStore();
    const toastStore = getToastStore();

    let backTarget = '/app/running/analytics/activities';
    afterNavigate(({ from }) => {
        backTarget = resolveBackTarget(from?.url.pathname, '/app/running/analytics/activities');
    });

    let detail = activity.detail;
    let detailLoading = false;
    let detailError: string | null = null;

    async function loadDetail(password?: string) {
        if (detailLoading) return;
        detailLoading = true;
        detailError = null;
        try {
            const res = await fetch(`/api/user/${user.id}/activities/${activity.id}/detail`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(password ? { password } : {}),
            });
            const payload = await res.json();
            if (!res.ok) {
                if (payload?.code === 'INVALID_TOKEN') {
                    openGarminLoginModal();
                    return;
                }
                detailError = payload?.message ?? 'Could not load activity details.';
                return;
            }
            detail = payload?.data?.detail ?? null;
        } catch (err) {
            detailError = err instanceof Error ? err.message : 'Could not load activity details.';
        } finally {
            detailLoading = false;
        }
    }

    function openGarminLoginModal() {
        triggerGarminLoginModal(modalStore, {
            body: "Your Garmin session expired. Sign in again to load this activity's splits and chart.",
            confirmText: 'Login and load',
            response: handleGarminLoginResponse,
        });
    }

    async function handleGarminLoginResponse(loginFormData: GarminLoginResponse) {
        if (!loginFormData) return;
        if (validateGarminLoginFormData(loginFormData)) {
            makeToast(toastStore, 'Invalid form data', 'variant-filled-error');
            return;
        }
        await loadDetail(loginFormData.password);
    }

    onMount(() => {
        if (!detail) void loadDetail();
    });

    function formatDate(iso: string): string {
        return new Date(iso).toLocaleString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    }

    function formatDistance(meters: number | null): string {
        if (!meters) return '—';
        return `${(meters / 1000).toFixed(2)} km`;
    }

    function formatDuration(sec: number | null): string {
        if (!sec) return '—';
        const h = Math.floor(sec / 3600);
        const m = Math.floor((sec % 3600) / 60);
        const s = Math.floor(sec % 60);
        if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        return `${m}:${s.toString().padStart(2, '0')}`;
    }

    function formatType(type: string): string {
        return type.replace(/_/g, ' ').toUpperCase();
    }
</script>

<Seo
    title="{activity.activityName ?? 'Activity'} | GymCraft™"
    metaDescription="Activity detail with splits and AI analysis." />

<Card width="3/4">
    <div class="flex justify-between items-center pb-4">
        <button type="button" on:click={() => goto(backTarget)} aria-label="Go back">
            <ArrowLeftIcon class="cursor-pointer text-surface-400 hover:text-surface-300" />
        </button>
    </div>

    <header class="mb-8">
        <div class="flex items-center gap-3 mb-2">
            <ActivityTypeIcon typeKey={activity.activityType} size={28} />
            <h1 class="h2 text-xl font-bold m-0">{activity.activityName ?? formatType(activity.activityType)}</h1>
        </div>
        <p class="text-sm opacity-70">{formatDate(activity.startTime)} · {formatType(activity.activityType)}</p>
    </header>

    <section class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-10">
        <StatCard label="Distance" value={formatDistance(activity.distanceM)} />
        <StatCard label="Duration" value={formatDuration(activity.durationSec)} />
        <StatCard label="Avg pace / speed" value={formatPaceOrSpeed(activity.averageSpeed, activity.activityType)} />
        <StatCard label="Avg HR" value={activity.averageHr != null ? `${activity.averageHr} bpm` : '—'} />
    </section>

    {#if detail}
        <section class="mb-10">
            <h2 class="h3 font-semibold mb-3">HR & pace over time</h2>
            <HrPaceOverlayChart samples={detail.samples} />
        </section>

        <section class="mb-10">
            <h2 class="h3 font-semibold mb-3">Splits</h2>
            <SplitsTable splits={detail.splits} activityType={activity.activityType} />
        </section>
    {:else if detailLoading}
        <section class="mb-10" aria-busy="true" aria-label="Loading activity details">
            <div class="placeholder animate-pulse mb-6" style="height: 16rem;" />
            <div class="space-y-2">
                {#each [0, 1, 2, 3] as row (row)}
                    <div class="placeholder animate-pulse" style="height: 2.5rem;" />
                {/each}
            </div>
        </section>
    {:else}
        <aside class="card variant-soft-surface p-4 mb-10">
            <p class="text-sm opacity-80 mb-3">
                {detailError ?? "Detailed splits and time-series for this activity haven't been loaded yet."}
            </p>
            <button type="button" class="btn btn-sm variant-soft-primary" on:click={() => loadDetail()}>
                Load details
            </button>
        </aside>
    {/if}

    <section class="mb-6">
        <AskAiPanel userId={user.id} activityDbId={activity.id} />
    </section>
</Card>
