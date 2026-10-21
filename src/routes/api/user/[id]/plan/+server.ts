import { createResponse } from '$lib/utils/response';
import { todayInTimezone } from '$lib/utils/iso-week';
import { getAthleteProfile, invalidateAthleteProfile } from '$lib/prisma/prisma';
import { validateCreatePlanInput } from '$lib/server/planner/validation';
import { buildPlan } from '$lib/server/planner/build-plan';
import { getLimit } from '@/constants/subscription.constants';
import { rescoreIfZonesChanged } from '$lib/server/garmin/score-runs';
import { strikeWeekBudget } from '$lib/server/planner/budget';
import {
    ActivePlanExistsError,
    MissingProfileError,
    getPlanningContext,
    persistNewPlan,
} from '$lib/server/planner/repository';

const PROFILE_REQUIRED = { code: 'PROFILE_REQUIRED', message: 'Set up your athlete profile first' };

/** Create a plan: lay out the whole horizon, write it, and record week 1's AI request (ADR 0014). */
export async function POST({
    request,
    params,
    locals,
}: {
    request: Request;
    params: { id: string };
    locals: App.Locals;
}): Promise<Response> {
    if (params.id !== locals.user?.id) {
        return createResponse(403, { message: 'Unauthorized' });
    }
    const userId = params.id;

    const profile = await getAthleteProfile(userId);
    if (!profile) return createResponse(409, PROFILE_REQUIRED);
    const today = todayInTimezone(profile.timezone);

    const validation = validateCreatePlanInput(await request.json(), today);
    if ('error' in validation) {
        return createResponse(400, { code: 'INVALID_BODY', message: validation.error });
    }

    const context = await getPlanningContext(userId, today);
    const built = buildPlan(context, validation.input, today);
    if (!built.ok) {
        const status = built.reason === 'Goal not found' ? 404 : 422;
        return createResponse(status, { code: 'LAYOUT_REFUSED', message: built.reason });
    }

    try {
        const model = locals.user?.aiModel ?? getLimit('FREE', 'aiModel');
        const budget = await strikeWeekBudget(userId, today, built.record.layout.weeks[0].inHorizonDays, 1);
        const plan = await persistNewPlan(userId, built.record, { model, input: built.week1Prompt, budget });
        invalidateAthleteProfile(userId);
        await rescoreIfZonesChanged(userId, profile.hrZoneBounds, built.record.hrZoneBounds);
        return createResponse(201, { data: plan });
    } catch (e) {
        if (e instanceof ActivePlanExistsError) {
            return createResponse(409, { code: 'ACTIVE_PLAN_EXISTS', message: e.message });
        }
        if (e instanceof MissingProfileError) return createResponse(409, PROFILE_REQUIRED);
        throw e;
    }
}
