// Browser side of week generation (ADR 0014): ask the proxy to run the AI request, then ask the app
// to finalize it. The browser holds only ids; a closed tab loses nothing because the proxy writes
// the output to the row and the next visit finalizes it.
import { appConfig } from '@/constants/app.constants';
import { isProduction } from '$lib/utils/environment';

export type WeekGenerationResult =
    { generation: 'GENERATED' } | { generation: 'FAILED'; retriesLeft: number } | { generation: 'PENDING' };

const proxyUrl = () => (isProduction() ? appConfig.aiRequestApiUrlPROD : appConfig.aiRequestApiUrlDEV);

/** Runs the proxy call; its own result does not matter, because the row records the outcome. */
async function runOnProxy(session: string, aiRequestId: string): Promise<void> {
    try {
        await fetch(proxyUrl(), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ session, aiRequestId }),
        });
    } catch (e) {
        console.warn('[week-generation] proxy call failed', e);
    }
}

export async function finalizeWeek(userId: string, weekId: string): Promise<WeekGenerationResult> {
    const response = await fetch(`/api/user/${userId}/plan/weeks/${weekId}/finalize`, { method: 'POST' });
    if (!response.ok) return { generation: 'PENDING' };
    const { data } = await response.json();
    return data as WeekGenerationResult;
}

export async function generateWeek(input: {
    userId: string;
    weekId: string;
    aiRequestId: string;
    session: string;
}): Promise<WeekGenerationResult> {
    await runOnProxy(input.session, input.aiRequestId);
    return finalizeWeek(input.userId, input.weekId);
}

export async function retryWeek(userId: string, weekId: string): Promise<{ aiRequestId: string } | { error: string }> {
    const response = await fetch(`/api/user/${userId}/plan/weeks/${weekId}/retry`, { method: 'POST' });
    const body = await response.json().catch(() => null);
    if (!response.ok) return { error: body?.message ?? 'Retry failed. Try again later.' };
    return { aiRequestId: body.data.aiRequestId };
}
