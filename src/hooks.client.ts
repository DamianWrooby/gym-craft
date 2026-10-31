import { defineCustomClientStrategy } from '$lib/paraglide/runtime';
import { marketingLocale } from '$lib/i18n/marketing-locale';

// Prerendered marketing pages carry their locale in the URL, not in the cookie (ADR 0028).
defineCustomClientStrategy('custom-marketing', {
    getLocale: () => marketingLocale(window.location.pathname),
    setLocale: () => undefined,
});
