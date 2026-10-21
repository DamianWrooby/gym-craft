// Browser calls for athlete-owned session changes: add, edit, mark, link, time-trial result.

type Outcome = { ok: true } | { error: string };

async function send(url: string, method: string, body: unknown, fallback: string): Promise<Outcome> {
    const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    if (response.ok) return { ok: true };
    const json = await response.json().catch(() => null);
    return { error: json?.message ?? fallback };
}

export const addSession = (userId: string, session: Record<string, unknown>) =>
    send(`/api/user/${userId}/plan/sessions`, 'POST', session, 'Could not add the session. Try again.');

export const editSession = (userId: string, sessionId: string, session: Record<string, unknown>) =>
    send(`/api/user/${userId}/plan/sessions/${sessionId}`, 'PATCH', session, 'Could not save the edit. Try again.');

export const markSession = (userId: string, sessionId: string, status: 'DONE' | 'SKIPPED' | 'PLANNED') =>
    send(`/api/user/${userId}/plan/sessions/${sessionId}/status`, 'POST', { status }, 'Could not save. Try again.');

export const recordTimeTrial = (userId: string, sessionId: string, timeSec: number) =>
    send(
        `/api/user/${userId}/plan/sessions/${sessionId}/time-trial`,
        'POST',
        { timeSec },
        'Could not save the result. Try again.',
    );

export const linkSession = (userId: string, sessionId: string, activityId: string) =>
    send(`/api/user/${userId}/plan/sessions/${sessionId}/link`, 'POST', { activityId }, 'Could not link. Try again.');

export const unlinkSession = (userId: string, sessionId: string) =>
    send(`/api/user/${userId}/plan/sessions/${sessionId}/link`, 'DELETE', {}, 'Could not unlink. Try again.');
