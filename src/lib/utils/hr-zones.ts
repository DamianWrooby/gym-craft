import type { GarminActivityHrZones } from '@/models/garmin/activity.model';

export interface HrZoneRow {
    hrZone1Sec: number | null;
    hrZone2Sec: number | null;
    hrZone3Sec: number | null;
    hrZone4Sec: number | null;
    hrZone5Sec: number | null;
}

export function hrZoneSecondsFromRow(row: HrZoneRow): GarminActivityHrZones | null {
    if (row.hrZone1Sec == null) return null;
    return {
        zone1: row.hrZone1Sec ?? 0,
        zone2: row.hrZone2Sec ?? 0,
        zone3: row.hrZone3Sec ?? 0,
        zone4: row.hrZone4Sec ?? 0,
        zone5: row.hrZone5Sec ?? 0,
    };
}
