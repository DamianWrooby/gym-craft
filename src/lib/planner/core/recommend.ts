// Recommend school (ADR 0019): a declared table, first match wins. Never an AI call.
import { m } from '$lib/paraglide/messages.js';
import { SCHOOLS } from '../schools/catalogue';
import { RECOMMENDATION_RULES } from '../schools/recommendation';
import type { SchoolId } from '../schools/types';

export interface RecommendInput {
    goal: { isRace: boolean; distanceM: number | null };
    horizonWeeks: number;
    anchorPresent: boolean;
    recentMetresPerWeek: number;
}

export interface Recommendation {
    recommended: { schoolId: SchoolId; reason: string } | null;
    offered: SchoolId[];
    filtered: { schoolId: SchoolId; reason: string }[];
}

export function recommendSchool(input: RecommendInput): Recommendation {
    const offered: SchoolId[] = [];
    const filtered: Recommendation['filtered'] = [];
    for (const s of SCHOOLS) {
        const floor = s.schoolFloorWeeks.value;
        if (input.horizonWeeks < floor) {
            filtered.push({
                schoolId: s.id,
                reason: m.recommend_needs_weeks({ floor, weeks: input.horizonWeeks }),
            });
        } else offered.push(s.id);
    }

    const distance = input.goal.distanceM;
    const match = RECOMMENDATION_RULES.value.find((rule) => {
        const c = rule.when;
        if (!offered.includes(rule.schoolId as SchoolId)) return false;
        if (c.anchorPresent !== undefined && c.anchorPresent !== input.anchorPresent) return false;
        if (c.goalMinM !== undefined && (distance == null || distance < c.goalMinM)) return false;
        if (c.goalMaxM !== undefined && (distance == null || distance > c.goalMaxM)) return false;
        if (c.horizonMinWeeks !== undefined && input.horizonWeeks < c.horizonMinWeeks) return false;
        if (c.horizonMaxWeeks !== undefined && input.horizonWeeks > c.horizonMaxWeeks) return false;
        if (c.recentMinMetres !== undefined && input.recentMetresPerWeek < c.recentMinMetres) return false;
        return true;
    });

    const recommended = match
        ? { schoolId: match.schoolId as SchoolId, reason: match.reason() }
        : offered.length > 0
          ? { schoolId: offered[0], reason: m.recommend_first_offered() }
          : null;
    return { recommended, offered, filtered };
}
