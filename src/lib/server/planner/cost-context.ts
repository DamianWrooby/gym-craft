// The pace and zone context an athlete-written session is costed and targeted with: today's anchor,
// so an edit after a new race result is priced on the paces the athlete now runs.
import { getAthleteProfile } from '$lib/prisma/prisma';
import { labelPaces, type TargetContext } from '$lib/planner/core/targets';
import { isValidZones } from '$lib/planner/core/zones';
import type { CostContext } from '$lib/planner/core/cost';
import type { SchoolDefinition } from '$lib/planner/schools/types';
import { anchorFromContext } from './build-plan';
import { getPlanningContext } from './repository';

export async function athleteSessionContext(
    userId: string,
    school: SchoolDefinition,
    goalDistanceM: number | null,
    today: string,
): Promise<{ cost: CostContext; targets: TargetContext }> {
    const [context, profile] = await Promise.all([getPlanningContext(userId, today), getAthleteProfile(userId)]);
    const anchor = anchorFromContext(context, [], goalDistanceM, today);
    const zones = isValidZones(profile?.hrZoneBounds) ? profile.hrZoneBounds : null;
    return { cost: { school, paceSecPerKm: labelPaces(school, anchor) }, targets: { school, anchor, zones } };
}
