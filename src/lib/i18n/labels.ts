// Display labels for stored enums, in the request's locale. The English *_LABELS constants stay
// for validation and AI prompts; the UI reads these so the label follows the athlete's locale.
import type { GoalType, Sex } from '@prisma/client';
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
