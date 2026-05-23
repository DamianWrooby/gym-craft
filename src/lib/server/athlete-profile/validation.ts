import { isValidDateString } from '$lib/utils/iso-week';
import { SEX_LABELS } from '@/constants/training-report.constants';
import type { AthleteProfileInput } from '$lib/prisma/prisma';
import type { Sex } from '@prisma/client';

const VALID_SEXES = Object.keys(SEX_LABELS) as Sex[];

export function validateAthleteProfileInput(body: unknown): { input: AthleteProfileInput } | { error: string } {
    if (!body || typeof body !== 'object') return { error: 'Body must be an object' };
    const b = body as Record<string, unknown>;

    if (typeof b.birthDate !== 'string' || !isValidDateString(b.birthDate)) {
        return { error: 'birthDate must be YYYY-MM-DD' };
    }
    const birthMs = Date.parse(`${b.birthDate}T00:00:00Z`);
    if (birthMs > Date.now()) {
        return { error: 'birthDate must be a valid past date' };
    }

    if (typeof b.sex !== 'string' || !VALID_SEXES.includes(b.sex as Sex)) {
        return { error: `sex must be one of ${VALID_SEXES.join(', ')}` };
    }

    if (typeof b.weightKg !== 'number' || b.weightKg <= 0 || b.weightKg > 500) {
        return { error: 'weightKg must be a positive number ≤ 500' };
    }

    if (typeof b.heightCm !== 'number' || !Number.isInteger(b.heightCm) || b.heightCm <= 0 || b.heightCm > 300) {
        return { error: 'heightCm must be a positive integer ≤ 300' };
    }

    const input: AthleteProfileInput = {
        birthDate: new Date(birthMs),
        sex: b.sex as Sex,
        weightKg: b.weightKg,
        heightCm: b.heightCm,
        timezone: typeof b.timezone === 'string' && b.timezone.length > 0 ? b.timezone : 'UTC',
    };

    if (b.restingHR !== undefined && b.restingHR !== null) {
        if (
            typeof b.restingHR !== 'number' ||
            !Number.isInteger(b.restingHR) ||
            b.restingHR <= 0 ||
            b.restingHR > 250
        ) {
            return { error: 'restingHR must be a positive integer ≤ 250' };
        }
        input.restingHR = b.restingHR;
    }

    if (b.maxHR !== undefined && b.maxHR !== null) {
        if (typeof b.maxHR !== 'number' || !Number.isInteger(b.maxHR) || b.maxHR <= 0 || b.maxHR > 250) {
            return { error: 'maxHR must be a positive integer ≤ 250' };
        }
        input.maxHR = b.maxHR;
    }

    if (b.hrZoneBounds !== undefined && b.hrZoneBounds !== null) {
        if (!Array.isArray(b.hrZoneBounds)) return { error: 'hrZoneBounds must be an array' };
        input.hrZoneBounds = b.hrZoneBounds as object;
    }

    if (b.vo2max !== undefined && b.vo2max !== null) {
        if (typeof b.vo2max !== 'number' || b.vo2max <= 0 || b.vo2max > 100) {
            return { error: 'vo2max must be a positive number ≤ 100' };
        }
        input.vo2max = b.vo2max;
    }

    return { input };
}
