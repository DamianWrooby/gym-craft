import type { ParamMatcher } from '@sveltejs/kit';
import { MARKETING_LOCALE_PREFIXES } from '$lib/i18n/marketing-locale';

/** The `/pl` prefix on marketing pages (ADR 0028). English has no prefix. */
export const match: ParamMatcher = (param) => (MARKETING_LOCALE_PREFIXES as readonly string[]).includes(param);
