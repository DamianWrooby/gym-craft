<script lang="ts">
    import { page } from '$app/stores';
    import { goto } from '$app/navigation';
    import { ArrowLeftIcon, InfoIcon, XIcon } from 'svelte-feather-icons';
    import Card from '$lib/components/card/Card.svelte';
    import DownloadAsPdf from '$lib/components/download-as-pdf/DownloadAsPdf.svelte';
    import PlanDescription from '$lib/components/plan-description/PlanDescription.svelte';
    import { makeToast } from '$lib/utils/toasts';
    import { getToastStore, getModalStore, type ModalSettings } from '@skeletonlabs/skeleton';
    import type { Plan, GeneratedWorkout } from '@models/plan/plan.model';
    import type { User } from '@/models/user/user.model';
    import { sanitizeObject } from '$lib/utils/sanitize';
    import { workoutProperties } from '@/constants/workout.constants';
    import { withGarminLogin } from '$lib/garmin/garmin-login';
    import { askGarminCredentials } from '$lib/garmin/garmin-login-modal';
    import { uploadWorkoutToGarmin } from '$lib/garmin/upload-workout';

    const modalStore = getModalStore();
    const toastStore = getToastStore();

    const user: User = $page.data.user;
    const userId = user.id;
    const plan: Plan | null = $page.data.plan;
    let planContainer: HTMLElement | null = null;
    let garminLoading: string | null = null;
    let uploadedWorkoutName: string | null = null;

    function goBackToPlanList() {
        goto('/app/gym/my-plans');
    }

    function openConfirmationModal(event: CustomEvent<{ workout: GeneratedWorkout }>) {
        const workout = event.detail.workout;
        garminLoading = workout.dayOfWeek;

        const modal: ModalSettings = {
            type: 'confirm',
            title: 'Confirmation',
            body: `<p>Selected workout will be send to your Garmin Connect account.</p>
            <br>
            <p>Do you want to continue?</p>`,
            buttonTextCancel: 'Cancel',
            buttonTextConfirm: 'Upload to Garmin',
            response: (confirmed: boolean) => (confirmed ? sendToGarmin(workout) : (garminLoading = null)),
        };
        modalStore.trigger(modal);
    }

    async function sendToGarmin(workout: GeneratedWorkout) {
        const sanitized = sanitizeObject(workout, workoutProperties);
        const result = await withGarminLogin(
            userId,
            () => uploadWorkoutToGarmin(userId, sanitized),
            () =>
                askGarminCredentials(modalStore, {
                    body: 'Provide credentials to connect to your Garmin Connect account and upload the workout.',
                    confirmText: 'Login and upload workout',
                }),
        );
        garminLoading = null;

        if (result.ok) {
            makeToast(toastStore, 'Workout uploaded successfully', 'variant-filled-success');
            uploadedWorkoutName = workout.workoutName;
            return;
        }
        const message = uploadFailureMessage(result.code, result.message);
        if (message) makeToast(toastStore, message, 'variant-filled-error');
    }

    function uploadFailureMessage(code: string, message: string): string | null {
        if (code === 'LOGIN_CANCELLED') return null;
        if (code === 'LOGIN_FAILED') return message || 'Garmin login failed';
        if (code === 'RATE_LIMITED') return 'Garmin is rate limiting requests <br> Please try again in a few minutes';
        if (message.includes('400 Client Error: Bad Request for url')) return 'Wrong workout format';
        return 'Garmin connection error <br> Please try again later';
    }
</script>

<Card width="3/4">
    <div class="flex justify-between pb-4">
        <button type="button" on:click={() => goBackToPlanList()}>
            <ArrowLeftIcon class="cursor-pointer text-surface-400 hover:text-surface-300" />
        </button>
        {#if plan && planContainer}
            <DownloadAsPdf {plan} />
        {/if}
    </div>
    {#if plan}
        {#if uploadedWorkoutName}
            <aside class="alert variant-ghost-success mb-5" role="status">
                <InfoIcon class="shrink-0" />
                <div class="alert-message">
                    <p>
                        <strong>{uploadedWorkoutName}</strong> is now in your Garmin Connect account. You can edit, reschedule,
                        or delete it in the Garmin Connect app. Changes made there do not sync back to GymCraft.
                    </p>
                </div>
                <div class="alert-actions">
                    <button
                        type="button"
                        class="btn-icon btn-icon-sm"
                        aria-label="Dismiss"
                        on:click={() => (uploadedWorkoutName = null)}>
                        <XIcon size="16" />
                    </button>
                </div>
            </aside>
        {/if}
        <div class="mb-5">
            <PlanDescription {garminLoading} {plan} on:sendToGarminClicked={openConfirmationModal} />
        </div>
    {:else}
        <h2 class="h2 text-center text-xl py-10">Plan not found</h2>
    {/if}
</Card>
