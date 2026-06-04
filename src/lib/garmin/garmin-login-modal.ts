import GarminLoginForm from '$lib/components/garmin-login-form/GarminLoginForm.svelte';
import type { ModalSettings, ModalStore } from '@skeletonlabs/skeleton';

export type GarminLoginResponse = { email: string; password: string } | false;

/**
 * Opens the shared "Sign in to Garmin Connect" modal. Used wherever an expired Garmin token
 * needs the user to re-enter their password (running hub, analytics — see also gym my-plans).
 */
export function triggerGarminLoginModal(
    modalStore: ModalStore,
    options: { body: string; confirmText?: string; response: (value: GarminLoginResponse) => void },
): void {
    const modal: ModalSettings = {
        type: 'component',
        title: 'Sign in to Garmin Connect',
        body: options.body,
        buttonTextCancel: 'Cancel',
        buttonTextConfirm: options.confirmText ?? 'Login and sync',
        component: { ref: GarminLoginForm },
        response: options.response as (value: unknown) => void,
    };
    modalStore.trigger(modal);
}
