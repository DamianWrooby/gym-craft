<script lang="ts">
    import { page } from '$app/stores';
    import { goto } from '$app/navigation';
    import { ArrowLeftIcon, InfoIcon, XIcon } from 'svelte-feather-icons';
    import Card from '$lib/components/card/Card.svelte';
    import DownloadAsPdf from '$lib/components/download-as-pdf/DownloadAsPdf.svelte';
    import PlanDescription from '$lib/components/plan-description/PlanDescription.svelte';
    import GarminLoginForm from '$lib/components/garmin-login-form/GarminLoginForm.svelte';
    import { makeToast } from '$lib/utils/toasts';
    import { getToastStore } from '@skeletonlabs/skeleton';
    import { getModalStore } from '@skeletonlabs/skeleton';
    import { to } from 'await-to-js';
    import type { Plan, GeneratedWorkout } from '@models/plan/plan.model';
    import type { User } from '@/models/user/user.model';
    import type { ModalComponent, ModalSettings } from '@skeletonlabs/skeleton';
    import { sanitizeObject } from '$lib/utils/sanitize';
    import { workoutProperties } from '@/constants/workout.constants';
    import { validateGarminLoginFormData, isValidEmailFormat } from '$lib/utils/form-validation';
    import { isInvalidTokenResponse } from '$lib/garmin/invalid-token';
    import { authenticateGarmin } from '$lib/garmin/authenticate';
    const modalStore = getModalStore();
    const modalComponent: ModalComponent = { ref: GarminLoginForm };

    const user: User = $page.data.user;
    const userId = user.id;
    const plan: Plan | null = $page.data.plan;
    const toastStore = getToastStore();
    let workoutToSend: GeneratedWorkout;
    let planContainer: HTMLElement | null = null;
    let garminLoading: string | null;
    let uploadedWorkoutName: string | null = null;

    type LoginFormData = { email: string; password: string };
    type EmailVerificationResponse = { email: string | false };

    function goBackToPlanList() {
        goto('/app/gym/my-plans');
    }

    function openGarminLoginModal() {
        const modal: ModalSettings = {
            type: 'component',
            title: 'Sign in to Garmin Connect',
            body: 'Provide credentials to connect to your Garmin Connect account and upload the workout.',
            buttonTextCancel: 'Cancel',
            buttonTextConfirm: 'Login and upload workout',
            component: modalComponent,
            response: sendToGarminFullCredentials,
        };
        modalStore.trigger(modal);
    }

    function openConfirmationModal(event: CustomEvent<{ workout: GeneratedWorkout }>) {
        workoutToSend = event.detail.workout;
        garminLoading = workoutToSend.dayOfWeek;

        const modal: ModalSettings = {
            type: 'confirm',
            title: 'Confirmation',
            body: `<p>Selected workout will be send to your Garmin Connect account.</p>
            <br>
            <p>Do you want to continue?</p>`,
            buttonTextCancel: 'Cancel',
            buttonTextConfirm: 'Upload to Garmin',
            response: checkGarminEmail,
        };
        modalStore.trigger(modal);
    }

    async function checkGarminEmail(modalResponse: boolean) {
        if (modalResponse) {
            const [verificationError, response] = await to(
                fetch(`/api/user/${userId}/garmin/check-email`, { method: 'GET' }),
            );

            if (verificationError || !response.ok) {
                makeToast(
                    toastStore,
                    verificationError?.message || 'Verification error <br> Please try again',
                    'variant-filled-error',
                );
                garminLoading = null;
                return;
            }

            const { email } = (await response?.json()) as EmailVerificationResponse;
            if (email) {
                sendToGarminEmailOnly(email);
            } else {
                openGarminLoginModal();
            }
        } else {
            garminLoading = null;
        }
    }

    async function sendToGarminFullCredentials(loginFormData: LoginFormData | false) {
        if (!loginFormData) {
            garminLoading = null;
            return;
        }
        if (!isValidLoginFormData(loginFormData)) {
            handleFormValidationError();
            return;
        }

        const { email, password } = loginFormData;
        const formValidationError = validateGarminLoginFormData({ email, password });

        if (formValidationError) {
            handleFormValidationError();
            return;
        }

        // The upload route no longer takes a password: it only uses the stored session token.
        // Store the email, exchange the password for a fresh session, then retry the upload.
        const emailSaved = await saveGarminEmail(email);
        if (!emailSaved) {
            makeToast(toastStore, 'Cannot save your Garmin email <br> Please try again', 'variant-filled-error');
            garminLoading = null;
            return;
        }

        const auth = await authenticateGarmin(userId, password);
        if (!auth.ok) {
            makeToast(toastStore, auth.message || 'Garmin login failed', 'variant-filled-error');
            garminLoading = null;
            return;
        }

        await sendWorkoutToGarmin();
    }

    async function sendToGarminEmailOnly(email: string) {
        if (!isValidEmailFormat(email)) {
            handleFormValidationError();
            return;
        }

        await sendWorkoutToGarmin();
    }

    async function sendWorkoutToGarmin() {
        const workout = sanitizeObject(workoutToSend, workoutProperties);
        const apiUrl = `/api/user/${userId}/garmin/upload-workout`;

        const [error, response] = await to(
            fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ workout }),
            }),
        );

        if (error || !response || !response.ok) {
            let payload: { code?: unknown; message?: unknown } | null = null;
            let message = 'Unknown error';
            if (response) {
                payload = await response.json().catch(() => null);
                message = typeof payload?.message === 'string' ? payload.message : message;
            } else if (error instanceof Error) {
                message = error.message;
            }

            // An unusable stored token is fixable: ask for the Garmin password instead of failing.
            if (isInvalidTokenResponse(response?.status, payload)) {
                makeToast(
                    toastStore,
                    'Invalid token <br> Please log in to your Garmin account',
                    'variant-filled-warning',
                );
                garminLoading = workoutToSend.dayOfWeek;
                openGarminLoginModal();
                return;
            }

            handleGarminPyConnectError(message, error);
            return;
        }

        const { status } = await response.json();

        if (status === 'success') {
            handleWorkoutUploadSuccess();
            garminLoading = null;
        }
    }

    function handleGarminPyConnectError(message: string, error: Error | null) {
        if (message.includes('400 Client Error: Bad Request for url')) {
            makeToast(toastStore, error?.message || 'Wrong workout format', 'variant-filled-error');
        } else {
            makeToast(
                toastStore,
                error?.message || 'Garmin connection error <br> Please try again later',
                'variant-filled-error',
            );
        }
        garminLoading = null;
    }

    function handleFormValidationError() {
        makeToast(toastStore, 'Form validation error', 'variant-filled-error');
        garminLoading = null;
    }

    function handleWorkoutUploadSuccess() {
        makeToast(toastStore, 'Workout uploaded successfully', 'variant-filled-success');
        uploadedWorkoutName = workoutToSend.workoutName;
    }

    async function saveGarminEmail(email: string): Promise<boolean> {
        const [error, apiResponse] = await to(
            fetch(`/api/user/${userId}/garmin/save-email`, {
                method: 'POST',
                body: JSON.stringify({ email }),
            }),
        );

        if (error || !apiResponse.ok) {
            console.error('Error when saving Garmin email');
            return false;
        }
        return true;
    }

    function isValidLoginFormData(data: unknown): data is LoginFormData {
        return typeof data === 'object' && data !== null;
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
