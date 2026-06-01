import type { GarminActivity, GarminActivityHrZones } from '@/models/garmin/activity.model';
import type { MetricsIntensity } from './types';

const EMPTY_ZONES: GarminActivityHrZones = { zone1: 0, zone2: 0, zone3: 0, zone4: 0, zone5: 0 };

export function computeIntensity(activities: GarminActivity[]): MetricsIntensity {
    let hasZoneData = false;
    const aggregate: GarminActivityHrZones = { ...EMPTY_ZONES };
    let moderateMinutes = 0;
    let vigorousMinutes = 0;

    for (const activity of activities) {
        if (activity.hrZones) {
            hasZoneData = true;
            aggregate.zone1 += activity.hrZones.zone1;
            aggregate.zone2 += activity.hrZones.zone2;
            aggregate.zone3 += activity.hrZones.zone3;
            aggregate.zone4 += activity.hrZones.zone4;
            aggregate.zone5 += activity.hrZones.zone5;
        }
        moderateMinutes += activity.moderateIntensityMinutes ?? 0;
        vigorousMinutes += activity.vigorousIntensityMinutes ?? 0;
    }

    if (!hasZoneData) {
        return {
            hrZoneSeconds: null,
            hrZonePercents: null,
            moderateMinutes,
            vigorousMinutes,
            polarizationIndex: null,
        };
    }

    const total = aggregate.zone1 + aggregate.zone2 + aggregate.zone3 + aggregate.zone4 + aggregate.zone5;

    const percents: GarminActivityHrZones =
        total > 0
            ? {
                  zone1: roundTo1((aggregate.zone1 / total) * 100),
                  zone2: roundTo1((aggregate.zone2 / total) * 100),
                  zone3: roundTo1((aggregate.zone3 / total) * 100),
                  zone4: roundTo1((aggregate.zone4 / total) * 100),
                  zone5: roundTo1((aggregate.zone5 / total) * 100),
              }
            : { ...EMPTY_ZONES };

    const lowIntensity = aggregate.zone1 + aggregate.zone2;
    const highIntensity = aggregate.zone3 + aggregate.zone4 + aggregate.zone5;
    const polarizationIndex = highIntensity > 0 ? roundTo2(lowIntensity / highIntensity) : null;

    return {
        hrZoneSeconds: aggregate,
        hrZonePercents: percents,
        moderateMinutes,
        vigorousMinutes,
        polarizationIndex,
    };
}

function roundTo1(n: number): number {
    return Math.round(n * 10) / 10;
}

function roundTo2(n: number): number {
    return Math.round(n * 100) / 100;
}
