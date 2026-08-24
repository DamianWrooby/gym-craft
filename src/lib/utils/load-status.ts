import type { AcwrStatus } from '$lib/server/analytics/load/interpret';

/**
 * The single visual language for ACWR training-load status, shared by the load-timeline
 * bars and the report-card borders so both read as one system. Four states, never three:
 * `overreach` (a planned-hard caution) stays distinct from `high-risk` (a warning) — see
 * interpret.ts. Colour is always paired with a text label; never encode status by hue alone.
 */
export const STATUS_LABEL: Record<AcwrStatus, string> = {
    undertraining: 'Undertraining',
    optimal: 'Optimal',
    overreach: 'Overreach',
    'high-risk': 'High risk',
};

export interface StatusStyle {
    /** Left-accent border colour for a report card. */
    accent: string;
    /** Timeline bar fill. */
    bar: string;
    /** Chip background + text for the status label. */
    chip: string;
    /** Subtle per-state tint for the whole report card. */
    card: string;
}

const STYLES: Record<AcwrStatus, StatusStyle> = {
    // The accent uses `!` so the left colour beats the card's all-side `dark:border-surface-700`,
    // which otherwise wins on source order and greys out every accent.
    undertraining: {
        accent: '!border-l-surface-400 dark:!border-l-surface-500',
        bar: 'bg-surface-400',
        // Brighter than variant-soft-surface, which read too close to the dark card background.
        chip: 'bg-surface-300 text-surface-900',
        card: 'bg-surface-500/10 hover:bg-surface-500/20',
    },
    optimal: {
        accent: '!border-l-success-500',
        bar: 'bg-success-500',
        chip: 'variant-soft-success',
        card: 'bg-success-500/10 hover:bg-success-500/20',
    },
    overreach: {
        accent: '!border-l-warning-500',
        bar: 'bg-warning-500',
        chip: 'variant-soft-warning',
        card: 'bg-warning-500/10 hover:bg-warning-500/20',
    },
    'high-risk': {
        accent: '!border-l-error-500',
        bar: 'bg-error-500',
        chip: 'variant-soft-error',
        card: 'bg-error-500/10 hover:bg-error-500/20',
    },
};

// A report whose load profile failed to compute (nullable columns, ADR 0006): neutral, never
// coerced to a status — interpretAcwr(0) is "undertraining", so a null must not read as one.
const NEUTRAL: StatusStyle = {
    accent: '!border-l-surface-300 dark:!border-l-surface-600',
    bar: 'bg-surface-300 dark:bg-surface-600',
    chip: 'variant-soft',
    card: 'hover:bg-surface-500/10',
};

function isAcwrStatus(value: string | null | undefined): value is AcwrStatus {
    return value != null && value in STYLES;
}

export function statusStyle(status: string | null | undefined): StatusStyle {
    return isAcwrStatus(status) ? STYLES[status] : NEUTRAL;
}

export function statusLabel(status: string | null | undefined): string {
    return isAcwrStatus(status) ? STATUS_LABEL[status] : 'No load data';
}
