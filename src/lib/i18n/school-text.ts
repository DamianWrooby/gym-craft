// The school catalogue in the request's locale, for display only. The catalogue itself stays in
// English: the AI prompts read it, and stored plan phases keep the English names they were laid
// out with. Every field falls back to the catalogue text when no message exists for it.
import { m } from '$lib/paraglide/messages.js';
import { LEAD_IN_NAME } from '$lib/planner/core/lead-in-name';
import { getSchool, isSchoolId } from '$lib/planner/schools/catalogue';
import type { SchoolDefinition } from '$lib/planner/schools/types';

const messages = m as unknown as Record<string, (() => string) | undefined>;

function text(key: string, fallback: string): string {
    return messages[key.replace(/-/g, '_')]?.() ?? fallback;
}

export function displaySchool(school: SchoolDefinition): SchoolDefinition {
    const p = `school_${school.id.toLowerCase()}`;
    return {
        ...school,
        name: text(`${p}_name`, school.name),
        tagline: text(`${p}_tagline`, school.tagline),
        lore: text(`${p}_lore`, school.lore),
        phases: school.phases.map((ph) => ({
            ...ph,
            name: text(`${p}_phase_${ph.key}_name`, ph.name),
            intent: text(`${p}_phase_${ph.key}_intent`, ph.intent),
            lossLine: text(`${p}_phase_${ph.key}_loss`, ph.lossLine),
        })),
        intensityLabels: school.intensityLabels.map((l) => ({ ...l, name: text(`${p}_label_${l.key}`, l.name) })),
        keySessions: school.keySessions.map((k) => ({
            ...k,
            name: text(`${p}_key_${k.key}_name`, k.name),
            reason: text(`${p}_key_${k.key}_reason`, k.reason),
        })),
        strengthTemplates: school.strengthTemplates.map((t) => ({
            ...t,
            name: text(`${p}_strength_${t.key}`, t.name),
        })),
    };
}

/** A stored phase in the locale, matched to the catalogue by its English name; anything else shows as stored. */
export function displayPhase(schoolId: string, name: string, intent: string): { name: string; intent: string } {
    if (name === LEAD_IN_NAME) return { name: m.lead_in_name(), intent };
    if (!isSchoolId(schoolId)) return { name, intent };
    const school = getSchool(schoolId);
    const index = school.phases.findIndex((p) => p.name === name);
    if (index < 0) return { name, intent };
    const shown = displaySchool(school).phases[index];
    return { name: shown.name, intent: school.phases[index].intent === intent ? shown.intent : intent };
}
