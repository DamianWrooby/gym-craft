import { db } from '$lib/database';
import { computeTrimp, type TrimpProfile } from './trimp';
import { hrZoneSecondsFromRow, type HrZoneRow } from '$lib/utils/hr-zones';

export type { TrimpProfile };

export interface TrimpSourceRow extends HrZoneRow {
    id: string;
    durationSec: number;
    averageHr: number | null;
    trimpLoad: number | null;
}

type WithTrimp<T extends TrimpSourceRow> = Omit<T, 'trimpLoad'> & { trimpLoad: number };

/**
 * Fill in missing `trimpLoad` values: compute TRIMP for every row where it is null and
 * persist the results, so the load engine (dashboard summary, weekly report) always works
 * on populated loads. Rows with an existing value are passed through untouched.
 */
export async function ensureTrimpLoads<T extends TrimpSourceRow>(
    rows: T[],
    profile: TrimpProfile,
): Promise<WithTrimp<T>[]> {
    const updates: { id: string; trimpLoad: number }[] = [];

    const filled = rows.map((row) => {
        if (row.trimpLoad != null) {
            return row as WithTrimp<T>;
        }
        const trimp = computeTrimp({
            durationSec: row.durationSec,
            hrZoneSeconds: hrZoneSecondsFromRow(row),
            averageHr: row.averageHr,
            restingHr: profile.restingHR,
            maxHr: profile.maxHR,
            sex: profile.sex ?? 'male',
        });
        updates.push({ id: row.id, trimpLoad: trimp });
        return { ...row, trimpLoad: trimp };
    });

    if (updates.length > 0) {
        await db.$transaction(
            updates.map((u) =>
                db.activity.update({
                    where: { id: u.id },
                    data: { trimpLoad: u.trimpLoad },
                }),
            ),
        );
    }

    return filled;
}
