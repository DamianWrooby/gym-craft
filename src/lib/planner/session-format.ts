// Plain-text rendering of a session body, shared by the week calendar and the PDF export so the
// two never disagree. Speaks GymCraft vocabulary only: labels, targets, exercises.
import { getSchool, isSchoolId } from './schools/catalogue';
import { displaySchool } from '$lib/i18n/school-text';
import { isRepeat, type RunBlock, type RunStep, type StepTarget } from './core/session';

export function formatPace(secPerKm: number): string {
    return `${Math.floor(secPerKm / 60)}:${String(secPerKm % 60).padStart(2, '0')}`;
}

export function formatTarget(target: StepTarget): string {
    return target.type === 'PACE'
        ? `${formatPace(target.minSecPerKm)}–${formatPace(target.maxSecPerKm)} /km`
        : `${target.lowerBpm}–${target.upperBpm} bpm`;
}

function formatAmount(step: RunStep): string {
    if (step.distanceM != null) {
        return step.distanceM >= 1000 ? `${Math.round(step.distanceM / 100) / 10} km` : `${step.distanceM} m`;
    }
    const sec = step.durationSec ?? 0;
    return sec % 60 === 0 ? `${sec / 60} min` : `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')} min`;
}

export function labelName(schoolId: string | null, label: string): string {
    if (!isSchoolId(schoolId)) return label;
    return displaySchool(getSchool(schoolId)).intensityLabels.find((l) => l.key === label)?.name ?? label;
}

/** "20 min · Threshold · 4:10–4:18 /km" */
export function formatStep(step: RunStep, schoolId: string | null): string {
    const parts = [formatAmount(step), labelName(schoolId, step.label)];
    if (step.target) parts.push(formatTarget(step.target));
    return parts.join(' · ');
}

export interface StepLine {
    text: string;
    note?: string;
    /** Steps inside a repeat are indented under it. */
    nested: boolean;
}

export function stepLines(blocks: RunBlock[], schoolId: string | null): StepLine[] {
    return blocks.flatMap((b) =>
        isRepeat(b)
            ? [
                  { text: `${b.repeat} ×`, nested: false },
                  ...b.steps.map((s) => ({ text: formatStep(s, schoolId), note: s.note, nested: true })),
              ]
            : [{ text: formatStep(b, schoolId), note: b.note, nested: false }],
    );
}
