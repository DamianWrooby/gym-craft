import { writable } from 'svelte/store';

export const loadingState = writable(false);
export const cookieBannerOpened = writable(false);
