import { describe, it, expect, vi } from 'vitest';

import { load, actions } from './+page.server';

describe('logout route', () => {
    it('redirects to /app on load', async () => {
        try {
            await load({} as any);
        } catch (e: any) {
            expect(e).toMatchObject({ status: 302, location: '/app' });
        }
    });

    it('clears session cookie and redirects to /app/login on action', async () => {
        const cookies = { set: vi.fn() } as any;
        const event = { cookies } as any;

        try {
            await actions.default(event);
        } catch (e: any) {
            expect(cookies.set).toHaveBeenCalledWith('session', '', {
                path: '/',
                expires: new Date(0),
            });
            expect(e).toMatchObject({ status: 302, location: '/app/login' });
        }
    });
});
