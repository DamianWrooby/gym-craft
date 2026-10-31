import { m } from '$lib/paraglide/messages.js';
import GarminLoginForm from '$lib/components/garmin-login-form/GarminLoginForm.svelte';
import GarminMfaForm from '$lib/components/garmin-login-form/GarminMfaForm.svelte';
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

/**
 * Promise form of the "enter the Garmin code" modal (email MFA), for `withGarminLogin`: resolves
 * the code, or null when the user cancels. `retry` switches the body to the wrong-code text.
 */
export function askGarminMfaCode(modalStore: ModalStore, retry: boolean): Promise<string | null> {
    return new Promise((resolve) => {
        modalStore.trigger({
            type: 'component',
            title: m.garmin_mfa_title(),
            body: retry ? m.garmin_mfa_retry_body() : m.garmin_mfa_body(),
            buttonTextCancel: m.common_cancel(),
            component: { ref: GarminMfaForm },
            response: (value: unknown) => resolve(typeof value === 'string' && value ? value : null),
        });
    });
}
