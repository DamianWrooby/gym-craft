import { computeTrimp, type TrimpProfile } from './trimp';
import { hrZoneSecondsFromRow, type HrZoneRow } from '$lib/utils/hr-zones';

export type { TrimpProfile };

export interface TrimpSourceRow extends HrZoneRow {
    durationSec: number;
    averageHr: number | null;
    trimpLoad: number | null;
}

type WithTrimp<T extends TrimpSourceRow> = Omit<T, 'trimpLoad'> & { trimpLoad: number };

/**
 * Fill in missing `trimpLoad` values in memory so the load engine (dashboard summary,
 * weekly report) always works on populated loads. Rows with an existing value are
 * passed through untouched.
 *
 * Deliberately does NOT persist. `sync-activities.ts` computes TRIMP at write time, so
 * a synced row always carries a load and in steady state there is nothing to fill —
 * this only covers legacy rows written before that was true. Since it runs on read
 * paths, persisting here meant a page GET issuing one UPDATE per row inside a
 * transaction. The computation is a handful of arithmetic ops, so recomputing it on
 * each read is far cheaper than the round trips that would save it.
 */
export function fillTrimpLoads<T extends TrimpSourceRow>(rows: T[], profile: TrimpProfile): WithTrimp<T>[] {
    return rows.map((row) => {
        if (row.trimpLoad != null) {
            return row as WithTrimp<T>;
        }
        return {
            ...row,
            trimpLoad: computeTrimp({
                durationSec: row.durationSec,
                hrZoneSeconds: hrZoneSecondsFromRow(row),
                averageHr: row.averageHr,
                restingHr: profile.restingHR,
                maxHr: profile.maxHR,
                sex: profile.sex ?? 'male',
            }),
        };
    });
}
