import { m } from '$lib/paraglide/messages.js';
import { createResponse } from '$lib/utils/response';
import { isValidDateString, todayInTimezone } from '$lib/utils/iso-week';
import { getAthleteProfile } from '$lib/prisma/prisma';
import { isSchoolId } from '$lib/planner/schools/catalogue';
import { getActivePlan } from '$lib/server/planner/repository';
import { RecutConflictError, applyRecut, planRecut, type RecutChange } from '$lib/server/planner/recut';

function readBody(body: unknown): { change: RecutChange; confirm: boolean } | string {
    if (typeof body !== 'object' || body === null) return 'Send a goal date or a school';
    const { endDate, schoolId, confirm } = body as Record<string, unknown>;
    if (endDate !== undefined && (typeof endDate !== 'string' || !isValidDateString(endDate))) {
        return 'endDate must be YYYY-MM-DD';
    }
    if (schoolId !== undefined && !isSchoolId(schoolId)) return 'Unknown school';
    return {
        change: { endDate: endDate as string | undefined, schoolId: schoolId as RecutChange['schoolId'] },
        confirm: confirm === true,
    };
}

/**
 * Recut the horizon (ADRs 0015, 0019): move the goal date or change the school. A small absorbed move
 * is applied at once; a full re-lay returns its cost and is applied only with `confirm: true`.
 */
export async function POST({
    request,
    params,
    locals,
}: {
    request: Request;
    params: { id: string };
    locals: App.Locals;
}): Promise<Response> {
    if (params.id !== locals.user?.id) return createResponse(403, { message: m.api_unauthorized() });

    const body: unknown = await request.json().catch(() => null);
    const read = readBody(body);
    if (typeof read === 'string') return createResponse(400, { code: 'INVALID_BODY', message: read });
    const { change, confirm } = read;

    const plan = await getActivePlan(params.id);
    if (!plan) return createResponse(404, { code: 'NO_PLAN', message: m.api_no_active_plan_long() });
    const profile = await getAthleteProfile(params.id);
    const today = todayInTimezone(profile?.timezone ?? 'UTC');

    const result = await planRecut(params.id, plan, today, change);
    if (result.kind === 'refused') return createResponse(422, { code: 'RECUT_REFUSED', message: result.reason });

    const preview = { kind: result.kind, summary: result.summary, losses: result.losses };
    if (result.kind === 'relaid' && !confirm) {
        return createResponse(200, { data: { applied: false, ...preview } });
    }
    try {
        await applyRecut(plan, result);
    } catch (e) {
        if (e instanceof RecutConflictError) return createResponse(409, { code: 'RECUT_CONFLICT', message: e.message });
        throw e;
    }
    return createResponse(200, { data: { applied: true, ...preview } });
}
