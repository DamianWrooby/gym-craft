<script lang="ts">
    import { page } from '$app/stores';
    import { goto, invalidateAll } from '$app/navigation';
    import { onMount } from 'svelte';
    import { getModalStore, getToastStore, type ModalComponent, type ModalSettings } from '@skeletonlabs/skeleton';
    import Card from '@components/card/Card.svelte';
    import Spinner from '$lib/components/loading/spinner/Spinner.svelte';
    import GarminLoginForm from '$lib/components/garmin-login-form/GarminLoginForm.svelte';
    import GenerateReportModal from '$lib/components/training-report/GenerateReportModal.svelte';
    import { ArrowLeftIcon } from 'svelte-feather-icons';
    import { formatReportPeriod, reportSummaryPreview } from '$lib/utils/report-format';
    import { makeToast } from '$lib/utils/toasts';
    import { to } from 'await-to-js';
    import { TIER_LIMITS } from '@/constants/subscription.constants';
    import type { User } from '@/models/user/user.model';
    import type { GoalType } from '@prisma/client';

    type ReportSummary = {
        id: string;
        periodStart: string;
        periodEnd: string;
        summary: string;
        createdAt: string;
    };

    type RunningGoalSummary = {
        id: string;
        goalType: GoalType;
        targetEventName: string | null;
        priority: number;
    };

    type GenerateRequest = {
        periodStart: string;
        periodEnd: string;
        goalIds: string[];
        notes?: string;
        password?: string;
        overwrite?: boolean;
    };

    const user: User = $page.data.user;
    const reports: ReportSummary[] = $page.data.reports;
    const monthlyReportCount: number = $page.data.monthlyReportCount;
    const hasProfile: boolean = $page.data.hasProfile;
    const goals: RunningGoalSummary[] = $page.data.goals;

    $: reportLimit = TIER_LIMITS[user.subscriptionTier].weeklyReportsPerMonth;
    $: slotsRemaining = reportLimit - monthlyReportCount;
    $: canGenerate = hasProfile && slotsRemaining > 0;

    const modalStore = getModalStore();
    const toastStore = getToastStore();

    let pendingRequest: GenerateRequest | null = null;
    let generating = false;

    onMount(() => {
        modalStore.clear();
    });

    function openGenerateModal() {
        if (!hasProfile) {
            makeToast(toastStore, 'Please set up your athlete profile first', 'variant-filled-warning');
            goto('/app/profile');
            return;
        }
        if (slotsRemaining <= 0) {
            makeToast(
                toastStore,
                `You've used all ${reportLimit} report generations this month.`,
                'variant-filled-warning',
            );
            return;
        }

        const component: ModalComponent = { ref: GenerateReportModal, props: { goals } };
        const modal: ModalSettings = {
            type: 'component',
            component,
            response: async (req: GenerateRequest | false) => {
                if (!req) return;
                await submitGeneration(req);
            },
        };
        modalStore.trigger(modal);
    }

    function openGarminLoginModal() {
        const component: ModalComponent = { ref: GarminLoginForm };
        const modal: ModalSettings = {
            type: 'component',
            title: 'Sign in to Garmin Connect',
            body: 'Provide your Garmin credentials to fetch activities.',
            buttonTextCancel: 'Cancel',
            buttonTextConfirm: 'Sign in and generate',
            component,
            response: async (cred: { email: string; password: string } | false) => {
                if (!cred || !pendingRequest) return;
                await submitGeneration({ ...pendingRequest, password: cred.password });
            },
        };
        modalStore.trigger(modal);
    }

    function openOverwriteConfirmModal(existingId: string) {
        const modal: ModalSettings = {
            type: 'confirm',
            title: 'A report for this week already exists',
            body: 'Overwriting will replace the existing report and still consume one of your generation slots. Continue?',
            buttonTextCancel: 'View existing instead',
            buttonTextConfirm: 'Overwrite',
            response: async (confirmed: boolean) => {
                if (!confirmed) {
                    goto(`/app/running/analytics/reports/${existingId}`);
                    return;
                }
                if (pendingRequest) {
                    await submitGeneration({ ...pendingRequest, overwrite: true });
                }
            },
        };
        modalStore.trigger(modal);
    }

    async function submitGeneration(req: GenerateRequest) {
        pendingRequest = req;
        generating = true;

        const [error, response] = await to(
            fetch(`/api/user/${user.id}/reports/weekly`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(req),
            }),
        );

        if (error || !response) {
            makeToast(toastStore, error?.message ?? 'Network error', 'variant-filled-error');
            generating = false;
            return;
        }

        const [parseError, data] = await to(response.json());
        if (parseError) {
            makeToast(toastStore, 'Invalid server response', 'variant-filled-error');
            generating = false;
            return;
        }

        if (response.ok) {
            await invalidateAll();
            makeToast(toastStore, 'Weekly report ready', 'variant-filled-success');
            generating = false;
            pendingRequest = null;
            goto(`/app/running/analytics/reports/${data.data.id}`);
            return;
        }

        switch (data?.code) {
            case 'PROFILE_REQUIRED':
                makeToast(toastStore, 'Please set up your athlete profile first', 'variant-filled-warning');
                generating = false;
                goto('/app/profile');
                return;
            case 'REPORT_EXISTS':
                generating = false;
                openOverwriteConfirmModal(data.existingId);
                return;
            case 'INVALID_TOKEN':
                generating = false;
                makeToast(toastStore, 'Please re-authenticate with Garmin', 'variant-filled-warning');
                openGarminLoginModal();
                return;
            case 'REPORT_LIMIT_REACHED':
                makeToast(
                    toastStore,
                    `You've used all ${reportLimit} report generations this month.`,
                    'variant-filled-warning',
                );
                break;
            case 'LLM_FAILED':
                makeToast(
                    toastStore,
                    'Coach service unavailable — your slot was not consumed.',
                    'variant-filled-error',
                );
                break;
            case 'INVALID_PERIOD':
            case 'INVALID_BODY':
            case 'INVALID_GOAL_IDS':
                makeToast(toastStore, data.message ?? 'Invalid request', 'variant-filled-error');
                break;
            default:
                makeToast(toastStore, data?.message ?? 'Failed to generate report', 'variant-filled-error');
        }

        generating = false;
    }
</script>

<Card width="3/4">
    <div class="flex justify-between items-center pb-2">
        <button type="button" on:click={() => goto('/app/running/analytics')} aria-label="Back to analytics">
            <ArrowLeftIcon class="cursor-pointer text-surface-400 hover:text-surface-300" />
        </button>
    </div>
    <div class="md:w-3/4 m-auto pb-8">
        <div class="flex flex-row justify-between items-center py-6">
            <h2 class="h2 text-xl font-bold">Weekly reports</h2>
            <span class="text-sm opacity-70">
                {monthlyReportCount}/{reportLimit} used this month
            </span>
        </div>

        {#if !hasProfile}
            <div class="alert variant-filled-warning mb-4">
                <p>
                    Set up your athlete profile before generating reports. We need basic info (age, weight, height) so
                    the coaching context is accurate.
                </p>
                <button class="btn variant-filled-primary mt-2" on:click={() => goto('/app/profile')}>
                    Go to profile
                </button>
            </div>
        {/if}

        <div class="flex justify-center mb-6">
            <button
                type="button"
                class="btn variant-filled-primary"
                disabled={!canGenerate || generating}
                on:click={openGenerateModal}>
                {generating ? 'Generating…' : 'Generate new report'}
            </button>
        </div>

        {#if generating}
            <Spinner size={10} />
        {/if}

        {#if reports.length === 0 && !generating}
            <p class="text-center opacity-70 italic">No reports yet.</p>
        {:else}
            <ul class="space-y-3">
                {#each reports as report (report.id)}
                    <li>
                        <button
                            type="button"
                            class="w-full text-left rounded-xl border border-surface-300 dark:border-surface-700 p-4 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
                            on:click={() => goto(`/app/running/analytics/reports/${report.id}`)}>
                            <div class="flex justify-between items-baseline">
                                <h3 class="font-semibold">
                                    Week of {formatReportPeriod(report.periodStart, report.periodEnd)}
                                </h3>
                                <span class="text-xs opacity-60">
                                    {new Date(report.createdAt).toLocaleDateString()}
                                </span>
                            </div>
                            <p class="text-sm opacity-80 mt-1">{reportSummaryPreview(report.summary)}</p>
                        </button>
                    </li>
                {/each}
            </ul>
        {/if}
    </div>
</Card>
