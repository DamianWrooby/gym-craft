<script lang="ts">
    import { page } from '$app/stores';
    import { goto } from '$app/navigation';
    import { ArrowLeftIcon } from 'svelte-feather-icons';
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
    import { appConfig } from '@/constants/app.constants';

    const modalStore = getModalStore();
    const modalComponent: ModalComponent = { ref: GarminLoginForm };

    const user: User = $page.data.user;
    const userId = user.id;
    const plan: Plan | null = $page.data.plan;
    const toastStore = getToastStore();
    let workoutToSend: GeneratedWorkout;
    let planContainer: HTMLElement | null = null;
    let garminLoading: string | null;

    type LoginFormData = { email: string; password: string };
    type EmailVerificationResponse = { email: string | false };

    function goBackToPlanList() {
        goto('/app/my-plans');
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
        if (!isValidLoginFormData(loginFormData)) hadleFormValidationError();

        const { email, password } = loginFormData;
        const formValidationError = validateGarminLoginFormData({ email, password });

        if (formValidationError) {
            hadleFormValidationError();
        }

        const formData = prepareWorkoutFormData(email, password);
        sendFormDataToGarmin(formData, email);
    }

    async function sendToGarminEmailOnly(email: string) {
        if (!isValidEmailFormat(email)) {
            hadleFormValidationError();
        }

        const formData = prepareWorkoutFormData(email);

        sendFormDataToGarmin(formData);
    }

    async function sendFormDataToGarmin(formData: FormData, email?: string) {
        const apiUrl = appConfig.internalGarminApiUrl;

        const [error, garminPyConnectResponse] = await to(fetch(apiUrl, { method: 'POST', body: formData }));

        if (error || !garminPyConnectResponse.ok) {
            const { message }: { message: string } = await garminPyConnectResponse?.json();
            handleGarminPyConnectError(message, error);

            if (message.includes('No valid token found')) {
                makeToast(
                    toastStore,
                    'Invalid token <br> Please log in to your Garmin account',
                    'variant-filled-warning',
                );
                garminLoading = workoutToSend.dayOfWeek;
                openGarminLoginModal();
            }

            return;
        }

        const { status } = await garminPyConnectResponse?.json();

        if (status === 'success') {
            handleWorkoutUploadSuccess(email);
            garminLoading = null;
        }
    }

    function prepareWorkoutFormData(email: string, password?: string): FormData {
        const workout = sanitizeObject(workoutToSend, workoutProperties);
        const jsonWorkout = JSON.stringify(workout);
        const workoutBlob = new Blob([jsonWorkout], { type: 'application/json' });

        const formData = new FormData();
        formData.append('username', email);
        if (password) formData.append('password', password);
        formData.append('file', workoutBlob, 'workout.json');

        return formData;
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

    function hadleFormValidationError() {
        makeToast(toastStore, 'Form validation error', 'variant-filled-error');
        garminLoading = null;
    }

    function handleWorkoutUploadSuccess(email?: string) {
        makeToast(toastStore, 'Workout uploaded successfully', 'variant-filled-success');
        if (email) saveGarminEmail(email);
    }

    async function saveGarminEmail(email: string) {
        const [error, apiResponse] = await to(
            fetch(`/api/user/${userId}/garmin/save-email`, {
                method: 'POST',
                body: JSON.stringify({ email }),
            }),
        );

        if (error || !apiResponse.ok) {
            console.error('Error when saving email <br> Please try again later');
        }
        garminLoading = null;
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
        <div class="mb-5">
            <PlanDescription {garminLoading} {plan} on:sendToGarminClicked={openConfirmationModal} />
        </div>
    {:else}
        <h2 class="h2 text-center text-xl py-10">Plan not found</h2>
    {/if}
</Card>
