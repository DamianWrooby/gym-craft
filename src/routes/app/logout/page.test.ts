import { describe, it, expect, vi } from 'vitest';

vi.mock('$lib/database', () => ({
    db: {
        user: {
            updateMany: vi.fn(),
        },
    },
}));

vi.mock('$lib/utils/environment', () => ({
    isProduction: vi.fn().mockReturnValue(true),
}));

vi.mock('crypto', () => ({
    default: {
        createHash: vi.fn().mockReturnValue({
            update: vi.fn().mockReturnValue({
                digest: vi.fn().mockReturnValue('hashed-session'),
            }),
        }),
    },
}));

const { db } = await import('$lib/database');
import { load, actions } from './+page.server';

describe('logout route', () => {
    it('redirects to /app on load', async () => {
        try {
            await load({} as any);
        } catch (e: any) {
            expect(e).toMatchObject({ status: 302, location: '/app' });
        }
    });

    it('invalidates session in DB, clears cookie, and redirects to /app/login on action', async () => {
        const cookies = {
            get: vi.fn().mockReturnValue('raw-session-token'),
            set: vi.fn(),
        } as any;
        const event = { cookies } as any;

        try {
            await actions.default(event);
        } catch (e: any) {
            expect(db.user.updateMany).toHaveBeenCalledWith({
                where: { userAuthToken: 'hashed-session' },
                data: { userAuthToken: '' },
            });
            expect(cookies.set).toHaveBeenCalledWith('session', '', {
                path: '/',
                expires: new Date(0),
                httpOnly: true,
                sameSite: 'strict',
                secure: true,
            });
            expect(e).toMatchObject({ status: 302, location: '/app/login' });
        }
    });
});
