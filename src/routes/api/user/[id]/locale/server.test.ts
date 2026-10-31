import { afterEach, describe, expect, it, vi } from 'vitest';

const env = vi.hoisted(() => ({ PUBLIC_APP_ENV: 'development' }));
vi.mock('$env/static/public', () => env);

const db = vi.hoisted(() => ({ user: { update: vi.fn() } }));
vi.mock('$lib/database', () => ({ db }));

import { PUT } from './+server';

function call(id: string, body: unknown) {
    const locals = { user: { id: 'user-1' } } as unknown as App.Locals;
    const cookies = { set: vi.fn() };
    const request = new Request('http://test/api/user/user-1/locale', { method: 'PUT', body: JSON.stringify(body) });
    return { cookies, response: PUT({ request, params: { id }, locals, cookies } as never) };
}

afterEach(() => {
    vi.clearAllMocks();
});

describe('PUT /api/user/[id]/locale', () => {
    it('accepts Polish in production', async () => {
        env.PUBLIC_APP_ENV = 'production';
        const res = await call('user-1', { locale: 'pl' }).response;
        env.PUBLIC_APP_ENV = 'development';
        expect(res.status).toBe(200);
    });

    it('returns 403 for another user', async () => {
        const res = await call('someone-else', { locale: 'pl' }).response;
        expect(res.status).toBe(403);
        expect(db.user.update).not.toHaveBeenCalled();
    });

    it('stores an enabled locale and mirrors it into the locale cookie', async () => {
        const { cookies, response } = call('user-1', { locale: 'pl' });
        const res = await response;
        expect(res.status).toBe(200);
        expect(db.user.update).toHaveBeenCalledWith({ where: { id: 'user-1' }, data: { locale: 'pl' } });
        expect(cookies.set).toHaveBeenCalledWith('PARAGLIDE_LOCALE', 'pl', expect.objectContaining({ path: '/' }));
    });

    it('rejects an unsupported locale', async () => {
        const res = await call('user-1', { locale: 'de' }).response;
        expect(res.status).toBe(400);
        expect(db.user.update).not.toHaveBeenCalled();
    });
});
