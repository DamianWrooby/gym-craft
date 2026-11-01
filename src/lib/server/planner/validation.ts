import { isValidDateString } from '$lib/utils/iso-week';
import { isSchoolId } from '$lib/planner/schools/catalogue';
import { isValidZones, type HrZoneBound } from '$lib/planner/core/zones';
import { WEEKDAYS, type AvailabilityMap } from '$lib/planner/wizard';
import type { SchoolId } from '$lib/planner/schools/types';
import { GYM_LEVELS, type Compression, type GymLevel } from '$lib/planner/core/layout';

import { RACE_MAX_M, RACE_MIN_M } from '$lib/utils/race';

export interface RaceResultInput {
    date: string;
    distanceM: number;
    timeSec: number;
    label: string | null;
}

export interface CreatePlanInput {
    goalId: string;
    schoolId: SchoolId;
    endDate: string | null;
    compression: Compression | null;
    hrZoneBounds: HrZoneBound[];
    raceResults: RaceResultInput[];
    availability: AvailabilityMap;
    longRunDay: number;
    gymLevel: GymLevel;
    sameDaySessions: boolean;
}

type Result<T> = { input: T } | { error: string };

export function validateRaceResultInput(body: unknown, today: string): Result<RaceResultInput> {
    if (!body || typeof body !== 'object') return { error: 'A race result must be an object' };
    const b = body as Record<string, unknown>;
    if (typeof b.date !== 'string' || !isValidDateString(b.date)) return { error: 'date must be YYYY-MM-DD' };
    if (b.date > today) return { error: 'A race result cannot be in the future' };
    if (
        typeof b.distanceM !== 'number' ||
        !Number.isInteger(b.distanceM) ||
        b.distanceM < RACE_MIN_M ||
        b.distanceM > RACE_MAX_M
    ) {
        return { error: `distanceM must be an integer from ${RACE_MIN_M} to ${RACE_MAX_M}` };
    }
    if (typeof b.timeSec !== 'number' || !Number.isInteger(b.timeSec) || b.timeSec <= 0) {
        return { error: 'timeSec must be a positive integer' };
    }
    if (b.label != null && (typeof b.label !== 'string' || b.label.length > 100)) {
        return { error: 'label must be text of at most 100 characters' };
    }
    return {
        input: { date: b.date, distanceM: b.distanceM, timeSec: b.timeSec, label: (b.label as string) || null },
    };
}

export function validateCreatePlanInput(body: unknown, today: string): Result<CreatePlanInput> {
    if (!body || typeof body !== 'object') return { error: 'Body must be an object' };
    const b = body as Record<string, unknown>;

    if (typeof b.goalId !== 'string' || !b.goalId) return { error: 'goalId is required' };
    if (!isSchoolId(b.schoolId)) return { error: 'schoolId is not a known training school' };

    let endDate: string | null = null;
    if (b.endDate != null) {
        if (typeof b.endDate !== 'string' || !isValidDateString(b.endDate))
            return { error: 'endDate must be YYYY-MM-DD' };
        endDate = b.endDate;
    }

    let compression: Compression | null = null;
    if (b.compression != null) {
        if (typeof b.compression !== 'object' || Array.isArray(b.compression)) {
            return { error: 'compression must map phase keys to weeks' };
        }
        for (const v of Object.values(b.compression)) {
            if (typeof v !== 'number' || !Number.isInteger(v) || v < 0) {
                return { error: 'compression weeks must be whole numbers' };
            }
        }
        compression = b.compression as Compression;
    }

    // Zones are required: every HR target in the plan must be the athlete's (ADR 0010).
    if (!isValidZones(b.hrZoneBounds)) return { error: 'Confirmed hrZoneBounds (five zones) are required' };

    const raceResults: RaceResultInput[] = [];
    if (b.raceResults != null) {
        if (!Array.isArray(b.raceResults) || b.raceResults.length > 10) {
            return { error: 'raceResults must be a list of at most 10' };
        }
        for (const r of b.raceResults) {
            const v = validateRaceResultInput(r, today);
            if ('error' in v) return v;
            raceResults.push(v.input);
        }
    }

    const a = b.availability as Record<string, unknown> | undefined;
    if (!a || typeof a !== 'object' || !WEEKDAYS.every((d) => typeof a[d] === 'boolean')) {
        return { error: 'availability must give true or false for every weekday' };
    }
    const availability = Object.fromEntries(WEEKDAYS.map((d) => [d, a[d]])) as AvailabilityMap;
    if (!WEEKDAYS.some((d) => availability[d])) return { error: 'Choose at least one training day' };

    if (typeof b.longRunDay !== 'number' || !Number.isInteger(b.longRunDay) || b.longRunDay < 0 || b.longRunDay > 6) {
        return { error: 'longRunDay must be 0 (Monday) to 6 (Sunday)' };
    }
    if (!availability[WEEKDAYS[b.longRunDay]]) return { error: 'The long-run day must be a training day' };

    const gymLevel = b.gymLevel ?? 'STANDARD';
    if (!GYM_LEVELS.includes(gymLevel as GymLevel)) return { error: 'gymLevel is not a known level' };
    const sameDaySessions = b.sameDaySessions ?? true;
    if (typeof sameDaySessions !== 'boolean') return { error: 'sameDaySessions must be true or false' };

    return {
        input: {
            goalId: b.goalId,
            schoolId: b.schoolId,
            endDate,
            compression,
            hrZoneBounds: b.hrZoneBounds,
            raceResults,
            availability,
            longRunDay: b.longRunDay,
            gymLevel: gymLevel as GymLevel,
            sameDaySessions,
        },
    };
}
