// Display labels for stored enums, in the request's locale. The English *_LABELS constants stay
// for validation and AI prompts; the UI reads these so the label follows the athlete's locale.
import type { GoalType, Sex } from '@prisma/client';
import type { OtherEffort, OtherModality } from '$lib/planner/core/session';
import { m } from '$lib/paraglide/messages.js';

export function goalTypeLabel(goalType: GoalType): string {
    return {
        RACE: m.goal_type_race,
        GENERAL_FITNESS: m.goal_type_general_fitness,
        BASE_BUILDING: m.goal_type_base_building,
        TEMPO_WORK: m.goal_type_tempo_work,
        RECOVERY: m.goal_type_recovery,
    }[goalType]();
}

export function sexLabel(sex: Sex): string {
    return { MALE: m.sex_male, FEMALE: m.sex_female, OTHER: m.sex_other }[sex]();
}

export function otherModalityLabel(modality: OtherModality): string {
    return { ride: m.modality_ride, swim: m.modality_swim, hike: m.modality_hike, other: m.modality_other }[modality]();
}

export function otherEffortLabel(effort: OtherEffort): string {
    return { easy: m.effort_easy, moderate: m.effort_moderate, hard: m.effort_hard }[effort]();
}
