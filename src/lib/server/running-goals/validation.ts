import { isValidDateString } from '$lib/utils/iso-week';
import { GOAL_TYPE_LABELS } from '@/constants/training-report.constants';
import type { RunningGoalCreateInput } from '$lib/prisma/prisma';
import type { GoalType } from '@prisma/client';

const VALID_GOAL_TYPES = Object.keys(GOAL_TYPE_LABELS) as GoalType[];
const NOTES_MAX = 500;

export function validateRunningGoalInput(
    body: unknown,
    options: { partial: boolean },
): { input: Partial<RunningGoalCreateInput> } | { error: string } {
    if (!body || typeof body !== 'object') return { error: 'Body must be an object' };
    const b = body as Record<string, unknown>;

    const input: Partial<RunningGoalCreateInput> = {};

    if (b.goalType !== undefined) {
        if (typeof b.goalType !== 'string' || !VALID_GOAL_TYPES.includes(b.goalType as GoalType)) {
            return { error: `goalType must be one of ${VALID_GOAL_TYPES.join(', ')}` };
        }
        input.goalType = b.goalType as GoalType;
    } else if (!options.partial) {
        return { error: 'goalType is required' };
    }

    if (b.priority !== undefined) {
        if (typeof b.priority !== 'number' || !Number.isInteger(b.priority) || b.priority < 1) {
            return { error: 'priority must be a positive integer' };
        }
        input.priority = b.priority;
    }

    if (b.targetEventName !== undefined) {
        if (b.targetEventName !== null && (typeof b.targetEventName !== 'string' || b.targetEventName.length > 200)) {
            return { error: 'targetEventName must be a string ≤ 200 chars or null' };
        }
        input.targetEventName = b.targetEventName as string | null;
    }

    if (b.targetEventDate !== undefined) {
        if (b.targetEventDate === null) {
            input.targetEventDate = null;
        } else {
            if (typeof b.targetEventDate !== 'string' || !isValidDateString(b.targetEventDate)) {
                return { error: 'targetEventDate must be YYYY-MM-DD or null' };
            }
            input.targetEventDate = new Date(`${b.targetEventDate}T00:00:00Z`);
        }
    }

    if (b.targetDistanceM !== undefined) {
        if (b.targetDistanceM !== null) {
            if (
                typeof b.targetDistanceM !== 'number' ||
                !Number.isInteger(b.targetDistanceM) ||
                b.targetDistanceM <= 0
            ) {
                return { error: 'targetDistanceM must be a positive integer or null' };
            }
        }
        input.targetDistanceM = b.targetDistanceM as number | null;
    }

    if (b.targetTimeSec !== undefined) {
        if (b.targetTimeSec !== null) {
            if (typeof b.targetTimeSec !== 'number' || !Number.isInteger(b.targetTimeSec) || b.targetTimeSec <= 0) {
                return { error: 'targetTimeSec must be a positive integer or null' };
            }
        }
        input.targetTimeSec = b.targetTimeSec as number | null;
    }

    if (b.notes !== undefined) {
        if (b.notes !== null) {
            if (typeof b.notes !== 'string' || b.notes.length > NOTES_MAX) {
                return { error: `notes must be a string ≤ ${NOTES_MAX} chars or null` };
            }
        }
        input.notes = b.notes as string | null;
    }

    return { input };
}
