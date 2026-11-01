<script lang="ts">
    import { m } from '$lib/paraglide/messages.js';
    import { getLocale } from '$lib/paraglide/runtime.js';
    import { page } from '$app/stores';
    import { goto, invalidateAll } from '$app/navigation';
    import { onMount } from 'svelte';
    import { getModalStore, getToastStore, type ModalComponent, type ModalSettings } from '@skeletonlabs/skeleton';
    import Card from '@components/card/Card.svelte';
    import Spinner from '$lib/components/loading/spinner/Spinner.svelte';
    import GarminLoginForm from '$lib/components/garmin-login-form/GarminLoginForm.svelte';
    import GenerateReportModal from '$lib/components/training-report/GenerateReportModal.svelte';
    import LoadBarChart from '$lib/components/training-report/LoadBarChart.svelte';
    import { ArrowLeftIcon, AlertTriangleIcon } from 'svelte-feather-icons';
    import { formatReportPeriod } from '$lib/utils/report-format';
    import { statusStyle, statusLabel } from '$lib/utils/load-status';
    import { makeToast, makeUpgradeToast } from '$lib/utils/toasts';
    import { to } from 'await-to-js';
    import { TIER_LIMITS } from '@/constants/subscription.constants';
    import type { User } from '@/models/user/user.model';
    import type { WeekCell } from '$lib/server/reports/week-timeline';
    import type { GoalType } from '@prisma/client';

    type ReportSummary = {
        id: string;
        periodStart: string;
        periodEnd: string;
        summaryPreview: string;
        createdAt: string;
        acwrStatus: string | null;
        weeklyTotalLoad: number | null;
        monotonyIsHigh: boolean | null;
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
    const timeline: WeekCell[] = $page.data.timeline;
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

    function notifyReportLimitReached() {
        const message = m.reports_limit_reached({ limit: reportLimit });
        if (user.subscriptionTier === 'FREE') {
            makeUpgradeToast(toastStore, message);
        } else {
            makeToast(toastStore, message, 'variant-filled-warning');
        }
    }

    function openGenerateModal(initialPeriodStart: string | null = null) {
        if (!hasProfile) {
            makeToast(toastStore, m.reports_profile_first(), 'variant-filled-warning');
            goto('/app/profile');
            return;
        }
        if (slotsRemaining <= 0) {
            notifyReportLimitReached();
            return;
        }

        const component: ModalComponent = { ref: GenerateReportModal, props: { goals, initialPeriodStart } };
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
            title: m.garmin_login_title(),
            body: m.reports_garmin_login_body(),
            buttonTextCancel: m.common_cancel(),
            buttonTextConfirm: m.reports_garmin_login_confirm(),
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
            title: m.reports_exists_title(),
            body: m.reports_exists_body(),
            buttonTextCancel: m.reports_exists_view(),
            buttonTextConfirm: m.reports_exists_overwrite(),
            response: async (confirmed: boolean) => {
                if (!confirmed) {
                    goto(`/app/analytics/reports/${existingId}`);
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
            makeToast(toastStore, error?.message ?? m.common_network_error(), 'variant-filled-error');
            generating = false;
            return;
        }

        const [parseError, data] = await to(response.json());
        if (parseError) {
            makeToast(toastStore, m.common_invalid_response(), 'variant-filled-error');
            generating = false;
            return;
        }

        if (response.ok) {
            await invalidateAll();
            makeToast(toastStore, m.reports_ready(), 'variant-filled-success');
            generating = false;
            pendingRequest = null;
            goto(`/app/analytics/reports/${data.data.id}`);
            return;
        }

        switch (data?.code) {
            case 'PROFILE_REQUIRED':
                makeToast(toastStore, m.reports_profile_first(), 'variant-filled-warning');
                generating = false;
                goto('/app/profile');
                return;
            case 'REPORT_EXISTS':
                generating = false;
                openOverwriteConfirmModal(data.existingId);
                return;
            case 'RATE_LIMITED':
                // Not a credential failure — prompting would make the throttle worse.
                generating = false;
                makeToast(toastStore, m.running_sync_rate_limited(), 'variant-filled-warning');
                return;
            case 'INVALID_TOKEN':
                generating = false;
                makeToast(toastStore, m.reports_reauth_garmin(), 'variant-filled-warning');
                openGarminLoginModal();
                return;
            case 'REPORT_LIMIT_REACHED':
                notifyReportLimitReached();
                break;
            case 'LLM_FAILED':
                makeToast(toastStore, m.reports_llm_failed(), 'variant-filled-error');
                break;
            case 'INVALID_PERIOD':
            case 'INVALID_BODY':
            case 'INVALID_GOAL_IDS':
                makeToast(toastStore, data.message ?? m.common_invalid_request(), 'variant-filled-error');
                break;
            default:
                makeToast(toastStore, data?.message ?? m.reports_failed(), 'variant-filled-error');
        }

        generating = false;
    }
</script>

<Card width="3/4">
    <div class="flex justify-between items-center pb-2">
        <button type="button" on:click={() => goto('/app/analytics')} aria-label={m.activities_back()}>
            <ArrowLeftIcon class="cursor-pointer text-surface-400 hover:text-surface-300" />
        </button>
    </div>
    <div class="md:w-3/4 m-auto pb-8">
        <div class="flex flex-row justify-between items-center py-6">
            <h2 class="h2 text-xl font-bold">{m.reports_heading()}</h2>
            <span class="text-sm opacity-70">
                {monthlyReportCount}/{reportLimit} used this month
            </span>
        </div>

        {#if !hasProfile}
            <div class="alert variant-filled-warning mb-4">
                <p>
                    {m.reports_profile_needed()}
                </p>
                <button class="btn variant-filled-primary mt-2" on:click={() => goto('/app/profile')}>
                    {m.reports_go_to_profile()}
                </button>
            </div>
        {/if}

        {#if reports.length > 0 || timeline.some((c) => c.state === 'gap')}
            <div class="mb-6">
                <LoadBarChart
                    {timeline}
                    on:open={(e) => goto(`/app/analytics/reports/${e.detail.reportId}`)}
                    on:generate={(e) => openGenerateModal(e.detail.periodStart)} />
            </div>
        {/if}

        <div class="flex justify-center mb-6">
            <button
                type="button"
                class="btn variant-filled-primary"
                disabled={!canGenerate || generating}
                on:click={() => openGenerateModal()}>
                {generating ? m.reports_generating() : m.analytics_generate_report()}
            </button>
        </div>

        {#if generating}
            <Spinner size={10} />
        {/if}

        {#if reports.length === 0 && !generating}
            <p class="text-center opacity-70 italic">{m.reports_empty()}</p>
        {:else}
            <ul class="space-y-3">
                {#each reports as report (report.id)}
                    {@const style = statusStyle(report.acwrStatus)}
                    <li>
                        <button
                            type="button"
                            class="w-full text-left rounded-xl border border-surface-300 dark:border-surface-700 border-l-4 {style.accent} {style.card} p-4 transition-colors"
                            on:click={() => goto(`/app/analytics/reports/${report.id}`)}>
                            <div class="flex justify-between items-baseline gap-2">
                                <h3 class="font-semibold">
                                    Week of {formatReportPeriod(report.periodStart, report.periodEnd)}
                                </h3>
                                <span class="text-xs opacity-60 whitespace-nowrap">
                                    {new Date(report.createdAt).toLocaleDateString(getLocale())}
                                </span>
                            </div>
                            <div class="flex flex-wrap items-center gap-2 mt-2">
                                <span class="chip {style.chip} text-xs">
                                    {statusLabel(report.acwrStatus)}
                                    {#if report.weeklyTotalLoad != null}
                                        · load {report.weeklyTotalLoad}
                                    {/if}
                                </span>
                                {#if report.monotonyIsHigh}
                                    <span class="chip variant-soft-warning text-xs inline-flex items-center gap-1">
                                        <AlertTriangleIcon size="12" /> High monotony
                                    </span>
                                {/if}
                            </div>
                            <p class="text-sm opacity-80 mt-2">{report.summaryPreview}</p>
                        </button>
                    </li>
                {/each}
            </ul>
        {/if}
    </div>
</Card>
