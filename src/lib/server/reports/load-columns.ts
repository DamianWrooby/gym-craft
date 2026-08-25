import type { MetricsLoadProfile } from '$lib/server/analytics/types';

export interface DenormalizedLoadColumns {
    acwrStatus: string | null;
    weeklyTotalLoad: number | null;
    monotonyIsHigh: boolean | null;
}

/**
 * The single mapping from a report's load profile to its denormalized TrainingReport
 * columns (ADR 0006). The report write path calls this; the one-time backfill script
 * (prisma/backfill-report-load-columns.mjs) mirrors it for untyped JSON. When a fourth
 * denormalized column is added, change it here and mirror it there.
 */
export function deriveLoadColumns(loadProfile: MetricsLoadProfile | null | undefined): DenormalizedLoadColumns {
    return {
        acwrStatus: loadProfile?.acwrStatus ?? null,
        weeklyTotalLoad: loadProfile?.weeklyTotalLoad ?? null,
        monotonyIsHigh: loadProfile?.monotonyIsHigh ?? null,
    };
}
