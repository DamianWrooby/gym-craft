import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import type { Action } from '../$types';

vi.mock('$lib/database', () => ({
    db: {
        user: {
            findUnique: vi.fn(),
            update: vi.fn(),
        },
    },
}));

vi.mock('bcrypt', () => ({
    default: {
        compare: vi.fn(),
    },
}));

vi.mock('$lib/utils/environment', () => ({
    isProduction: vi.fn(),
}));

vi.mock('$lib/utils/form-validation', () => ({
    isString: vi.fn(),
}));

const { db } = await import('$lib/database');
import { actions } from './+page.server';
import { isProduction } from '$lib/utils/environment';
import { isString } from '$lib/utils/form-validation';
import bcrypt from 'bcrypt';

const mockFindUniqueUser = db.user.findUnique as unknown as Mock;
const mockUpdateUser = db.user.update as unknown as Mock;

function mockRequestWithFormData({
    username = 'john',
    password = 'secret123',
}: {
    username?: string;
    password?: string;
}) {
    const formData = new FormData();
    formData.set('username', username as string);
    formData.set('password', password as string);

    const cookies = {
        set: vi.fn(),
    } as any;

    return {
        request: {
            formData: async () => formData,
        },
        cookies,
    } as any;
}

beforeEach(() => {
    vi.clearAllMocks();
    vi.resetAllMocks();

    vi.stubGlobal('crypto', { randomUUID: vi.fn() });
    (crypto.randomUUID as any).mockReturnValue('uuid');

    vi.mocked(isString).mockReturnValue(true);
    vi.mocked(isProduction).mockReturnValue(true);

    mockFindUniqueUser.mockResolvedValue({
        username: 'john',
        passwordHash: 'hashed',
    });
    (bcrypt.compare as unknown as Mock).mockResolvedValue(true);
    mockUpdateUser.mockResolvedValue({ userAuthToken: 'uuid' });
});

describe('login action', () => {
    const login = actions.login as Action;

    it('returns fail if any field is not a string', async () => {
        const event = mockRequestWithFormData({});
        vi.mocked(isString).mockReturnValue(false);
        const result = await login(event);
        expect(result).toMatchInlineSnapshot(`
ActionFailure {
  "data": {
    "invalid": true,
  },
  "status": 400,
}
`);
    });

    it('returns fail if user not found', async () => {
        const event = mockRequestWithFormData({});
        mockFindUniqueUser.mockResolvedValue(null);
        const result = await login(event);
        expect(result).toMatchInlineSnapshot(`
ActionFailure {
  "data": {
    "credentials": true,
  },
  "status": 400,
}
`);
    });

    it('returns fail if password mismatch', async () => {
        const event = mockRequestWithFormData({});
        (bcrypt.compare as unknown as Mock).mockResolvedValue(false);
        const result = await login(event);
        expect(result).toMatchInlineSnapshot(`
ActionFailure {
  "data": {
    "credentials": true,
  },
  "status": 400,
}
`);
    });

    it('sets cookie and redirects on success', async () => {
        const event = mockRequestWithFormData({});

        try {
            await login(event);
        } catch (e: any) {
            expect(mockUpdateUser).toHaveBeenCalledWith({
                where: { username: 'john' },
                data: { userAuthToken: 'uuid' },
            });
            expect(event.cookies.set).toHaveBeenCalledWith('session', 'uuid', {
                path: '/',
                httpOnly: true,
                sameSite: 'strict',
                secure: true,
                maxAge: 60 * 60 * 24 * 30,
            });
            expect(e).toMatchObject({ status: 302, location: '/app' });
        }
    });
});
