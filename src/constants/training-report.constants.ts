import type { GoalType, ReportType, Sex } from '@prisma/client';

export const EXPLAIN_QUESTION_MAX_LENGTH = 280;

export const REPORT_NOTES_MAX_LENGTH = 200;

export const GOAL_TYPE_LABELS: Record<GoalType, string> = {
    RACE: 'Race',
    GENERAL_FITNESS: 'General fitness',
    BASE_BUILDING: 'Base building',
    TEMPO_WORK: 'Tempo work',
    RECOVERY: 'Recovery',
};

export const SEX_LABELS: Record<Sex, string> = {
    MALE: 'Male',
    FEMALE: 'Female',
    OTHER: 'Other',
};

export const REPORT_TYPE_LABELS: Record<ReportType, string> = {
    WEEKLY: 'Weekly',
    MONTHLY: 'Monthly',
    MICROCYCLE: 'Microcycle',
};
