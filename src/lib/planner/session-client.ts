// Browser calls for athlete-owned session changes: add, edit, mark, link, time-trial result.
import { m } from '$lib/paraglide/messages.js';

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
    send(`/api/user/${userId}/plan/sessions`, 'POST', session, m.client_add_session_failed());

export const editSession = (userId: string, sessionId: string, session: Record<string, unknown>) =>
    send(`/api/user/${userId}/plan/sessions/${sessionId}`, 'PATCH', session, m.client_edit_failed());

export const markSession = (userId: string, sessionId: string, status: 'DONE' | 'SKIPPED' | 'PLANNED') =>
    send(`/api/user/${userId}/plan/sessions/${sessionId}/status`, 'POST', { status }, m.client_save_failed());

export const recordTimeTrial = (userId: string, sessionId: string, timeSec: number) =>
    send(`/api/user/${userId}/plan/sessions/${sessionId}/time-trial`, 'POST', { timeSec }, m.client_result_failed());

export const linkSession = (userId: string, sessionId: string, activityId: string) =>
    send(`/api/user/${userId}/plan/sessions/${sessionId}/link`, 'POST', { activityId }, m.client_link_failed());

export const unlinkSession = (userId: string, sessionId: string) =>
    send(`/api/user/${userId}/plan/sessions/${sessionId}/link`, 'DELETE', {}, m.client_unlink_failed());
