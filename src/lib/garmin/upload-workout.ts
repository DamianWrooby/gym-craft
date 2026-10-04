import { to } from 'await-to-js';
import { classifyGarminFailure, type GarminFailureKind } from './garmin-failure';

export type UploadWorkoutResult =
    | { ok: true }
    | { ok: false; code: GarminFailureKind | 'GARMIN_EMAIL_NOT_CONFIGURED' | 'NETWORK_ERROR'; message: string };

/**
 * Sends one workout to the user's Garmin Connect account through the SvelteKit route, which owns
 * the stored session and its silent renewal. Pair with `withGarminLogin` for the password prompt.
 */
export async function uploadWorkoutToGarmin(userId: string, workout: unknown): Promise<UploadWorkoutResult> {
    const [fetchError, response] = await to(
        fetch(`/api/user/${userId}/garmin/upload-workout`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ workout }),
        }),
    );
    if (fetchError || !response) {
        return { ok: false, code: 'NETWORK_ERROR', message: fetchError?.message ?? 'Garmin connection error' };
    }

    const payload: { code?: unknown; message?: unknown; status?: unknown } | null = await response
        .json()
        .catch(() => null);
    if (response.ok && payload?.status === 'success') return { ok: true };

    const message = typeof payload?.message === 'string' ? payload.message : 'Garmin connection error';
    if (payload?.code === 'GARMIN_EMAIL_NOT_CONFIGURED') {
        return { ok: false, code: 'GARMIN_EMAIL_NOT_CONFIGURED', message };
    }
    return { ok: false, code: classifyGarminFailure(response.status, payload), message };
}
