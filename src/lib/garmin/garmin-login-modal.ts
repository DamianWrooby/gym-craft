import { m } from '$lib/paraglide/messages.js';
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
        title: m.garmin_login_title(),
        body: options.body,
        buttonTextCancel: m.common_cancel(),
        buttonTextConfirm: options.confirmText ?? m.garmin_login_confirm(),
        component: { ref: GarminLoginForm },
        response: options.response as (value: unknown) => void,
    };
    modalStore.trigger(modal);
}

/**
 * Promise form of the login modal, for `withGarminLogin`: resolves the credentials, or null when
 * the user cancels.
 */
export function askGarminCredentials(
    modalStore: ModalStore,
    options: { body: string; confirmText?: string },
): Promise<{ email: string; password: string } | null> {
    return new Promise((resolve) => {
        triggerGarminLoginModal(modalStore, { ...options, response: (value) => resolve(value || null) });
    });
}
