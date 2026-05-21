import type { GoalType, ReportType, Sex } from '@prisma/client';

// Per-user monthly cap on LLM-generated weekly reports.
// Every successful generation (new or overwrite) consumes one slot for the
// current calendar month; empty-week reports do NOT consume a slot.
// Tracked via the AiUsage table with kind='weekly_report' and day=first-of-month.
// Raise once subscriptions land.
export const WEEKLY_REPORT_MONTHLY_LIMIT = 4;

// Per-user daily cap on AI "Explain my run" calls. Raise once subscriptions land.
export const EXPLAIN_RUN_DAILY_LIMIT = 10;

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
