import { addDays, isFutureDate, isMonday, isValidDateString } from '$lib/utils/iso-week';
import { REPORT_NOTES_MAX_LENGTH } from '@/constants/training-report.constants';

export interface WeeklyReportBody {
    periodStart: string;
    periodEnd: string;
    goalIds: string[];
    notes?: string;
    password?: string;
    overwrite?: boolean;
}

export function validateBody(body: Partial<WeeklyReportBody>):
    | { value: Required<Pick<WeeklyReportBody, 'periodStart' | 'periodEnd' | 'goalIds'>> & WeeklyReportBody }
    | { error: string; code: string } {
    if (!body || typeof body !== 'object') {
        return { error: 'Body must be an object', code: 'INVALID_BODY' };
    }
    if (typeof body.periodStart !== 'string' || typeof body.periodEnd !== 'string') {
        return { error: 'periodStart and periodEnd must be strings', code: 'INVALID_BODY' };
    }
    if (!Array.isArray(body.goalIds) || body.goalIds.some((id) => typeof id !== 'string')) {
        return { error: 'goalIds must be an array of strings', code: 'INVALID_BODY' };
    }
    if (body.notes !== undefined && body.notes !== null) {
        if (typeof body.notes !== 'string' || body.notes.length > REPORT_NOTES_MAX_LENGTH) {
            return { error: `notes must be ≤ ${REPORT_NOTES_MAX_LENGTH} chars`, code: 'INVALID_BODY' };
        }
    }

    return {
        value: {
            periodStart: body.periodStart,
            periodEnd: body.periodEnd,
            goalIds: body.goalIds as string[],
            notes: body.notes ?? undefined,
            password: body.password,
            overwrite: body.overwrite === true,
        },
    };
}

export function validateDates(
    periodStart: string,
    periodEnd: string,
    timezone: string,
): { ok: true } | { error: string } {
    if (!isValidDateString(periodStart) || !isValidDateString(periodEnd)) {
        return { error: 'periodStart and periodEnd must be YYYY-MM-DD' };
    }
    if (!isMonday(periodStart)) return { error: 'periodStart must be a Monday' };
    if (addDays(periodStart, 6) !== periodEnd) return { error: 'periodEnd must be 6 days after periodStart (Sunday)' };
    if (isFutureDate(periodEnd, timezone)) return { error: 'periodEnd must not be in the future' };
    return { ok: true };
}
