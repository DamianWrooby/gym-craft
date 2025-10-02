import { writable, type Writable } from 'svelte/store';

export const loadingState: Writable<boolean> = writable(false);
export const cookieBannerOpened: Writable<boolean> = writable(false);
