import { redirect } from '@sveltejs/kit';
import { hashSessionToken } from '$lib/server/session-token';
import { readPlanPage, type PlanPage } from '$lib/server/planner/plan-page';

export const load = async ({
    locals,
    cookies,
}: {
    locals: App.Locals;
    cookies: { get(name: string): string | undefined };
}): Promise<PlanPage & { proxySession: string | null }> => {
    const userId = locals.user?.id;
    if (!userId) redirect(302, '/app/login');

    const page = await readPlanPage(userId, locals.user.subscriptionTier);
    if (!page.plan) return { ...page, proxySession: null };
    // The proxy matches the hashed token against User.userAuthToken; the raw cookie stays httpOnly.
    const session = cookies.get('session');
    return { ...page, proxySession: session ? hashSessionToken(session) : null };
};
