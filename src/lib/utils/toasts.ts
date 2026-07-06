import type { ToastSettings, ToastStore } from '@skeletonlabs/skeleton';

export const makeToast = (toastStore: ToastStore, message: string, background: string) => {
    const toast: ToastSettings = {
        message,
        background,
    };
    toastStore.trigger(toast);
};

// Cap-reached warning with an upgrade CTA. Longer timeout so the link is actually clickable.
export const makeUpgradeToast = (toastStore: ToastStore, message: string) => {
    const toast: ToastSettings = {
        message: `${message}<br><a href="/app/my-account" class="anchor font-semibold">Upgrade to Supporter →</a>`,
        background: 'variant-filled-warning',
        timeout: 8000,
    };
    toastStore.trigger(toast);
};
