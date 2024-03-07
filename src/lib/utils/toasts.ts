import type { ToastSettings, ToastStore } from '@skeletonlabs/skeleton';

export const makeToast = (toastStore: ToastStore, message: string, background: string) => {
    const toast: ToastSettings = {
        message,
        background,
    };
    toastStore.trigger(toast);
};
