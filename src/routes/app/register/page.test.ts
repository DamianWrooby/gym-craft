import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import type { Action } from '../$types';

vi.mock('$lib/database', () => ({
    db: {
        user: {
            findUnique: vi.fn(),
            findFirst: vi.fn(),
            create: vi.fn(),
        },
        roles: {
            findUnique: vi.fn(),
            create: vi.fn(),
        },
    },
}));
vi.mock('bcrypt', () => ({
    default: {
        hash: vi.fn(),
    },
}));
vi.mock('await-to-js', () => ({
    to: vi.fn(),
}));
vi.mock('$lib/server/mail', () => ({
    sendVerificationToken: vi.fn(),
}));
vi.mocked(sendVerificationToken).mockReturnValue(
    new Promise((resolve) =>
        resolve({
            id: 'mocked-token',
            userId: 'mocked-user-id',
            tokenHash: 'mocked-token-hash',
            expiresAt: new Date(Date.now() + 3600000),
            usedAt: null,
            isUsed: false,
            createdAt: new Date(),
        }),
    ),
);
vi.mock('$lib/utils/environment', () => ({
    isProduction: vi.fn(),
}));

vi.mock('$lib/utils/form-validation', () => ({
    validateRegisterFormData: vi.fn(),
    isString: vi.fn(),
}));

const { db } = await import('$lib/database');

import { actions } from './+page.server';
import { isProduction } from '$lib/utils/environment';
import { validateRegisterFormData, isString } from '$lib/utils/form-validation';
import { sendVerificationToken } from '$lib/server/mail';
import { to } from 'await-to-js';
import bcrypt from 'bcrypt';

const mockFindUniqueUser = db.user.findUnique as unknown as Mock;
const mockFindFirstUser = db.user.findFirst as unknown as Mock;
const mockCreateUser = db.user.create as unknown as Mock;
const mockFindUniqueRole = db.roles.findUnique as unknown as Mock;
const mockCreateRole = db.roles.create as unknown as Mock;

const testRole = { name: 'USER' };
const testUser = {
    id: 1,
    email: 'b',
};

function setMocks() {
    mockFindUniqueUser.mockResolvedValue(null);
    mockFindUniqueRole.mockResolvedValue(null);
    mockCreateRole.mockResolvedValue(testRole);
    mockCreateUser.mockResolvedValue(testUser);
    mockFindFirstUser.mockResolvedValue({ email: 'user@example.com' });
    vi.stubGlobal('crypto', { randomUUID: vi.fn() });
    vi.mocked(to).mockReturnValue(new Promise((resolve) => resolve([null, 'token'])));
    (bcrypt.hash as Mock).mockResolvedValue('hashed');
    (crypto.randomUUID as any).mockReturnValue('uuid');
    vi.mocked(isString).mockReturnValue(true);
    vi.mocked(isProduction).mockReturnValue(true);
    vi.mocked(validateRegisterFormData).mockReturnValue(null);
    vi.mocked(isString).mockReturnValue(true);
}

function mockRequestWithFormData({
    username = 'john',
    email = 'john@example.com',
    password = 'secret123',
    confirmPassword = 'secret123',
    termsOfUse = 'true',
    marketingAgreement = 'false',
}: {
    username?: string;
    email?: string;
    password?: string;
    confirmPassword?: string;
    termsOfUse?: string;
    marketingAgreement?: string;
}) {
    const formData = new FormData();
    formData.set('username', username);
    formData.set('email', email);
    formData.set('password', password);
    formData.set('confirmPassword', confirmPassword);
    formData.set('termsOfUse', termsOfUse);
    formData.set('marketingAgreement', marketingAgreement);

    return {
        request: {
            formData: async () => formData,
        },
    };
}

beforeEach(() => {
    vi.clearAllMocks();
    vi.resetAllMocks();
    setMocks();
});

describe('register action', () => {
    const register = actions.register as Action;

    it('returns fail if any field is not a string', async () => {
        const event = mockRequestWithFormData({});
        vi.mocked(isString).mockReturnValue(false);
        const result = await register(event as any);
        const snapshot = `ActionFailure {
  "data": {
    "invalidEntry": true,
  },
  "status": 400,
}`;

        expect(result).toMatchInlineSnapshot(snapshot);
    });

    it('returns fail if termsOfUse is not checked', async () => {
        const event = mockRequestWithFormData({ termsOfUse: 'false' });
        const result = await register(event as any);

        const snapshot = `ActionFailure {
  "data": {
    "termsOfUse": true,
  },
  "status": 400,
}`;

        expect(result).toMatchInlineSnapshot(snapshot);
    });

    it('returns fail if username exists', async () => {
        mockFindUniqueUser.mockResolvedValue({ username: 'a' });
        const event = mockRequestWithFormData({});
        const result = await register(event as any);
        const snapshot = `ActionFailure {
  "data": {
    "userExists": true,
  },
  "status": 400,
}`;
        expect(result).toMatchInlineSnapshot(snapshot);
    });

    it('returns fail if email exists in production', async () => {
        mockFindFirstUser.mockResolvedValue({ email: 'email@test.com' });
        const event = mockRequestWithFormData({});
        const result = await register(event as any);
        const snapshot = `ActionFailure {
  "data": {
    "emailExists": true,
  },
  "status": 400,
}`;
        expect(result).toMatchInlineSnapshot(snapshot);
    });

    it('creates role if not exists', async () => {
        mockFindUniqueRole.mockResolvedValue(null);
        mockFindFirstUser.mockResolvedValue(null);
        const event = mockRequestWithFormData({});
        try {
            await register(event as any);
        } catch (e) {
            expect(mockCreateRole).toHaveBeenCalledWith({ data: { name: 'USER' } });
        }
    });

    it('creates user with correct data', async () => {
        const event = mockRequestWithFormData({});
        mockFindFirstUser.mockResolvedValue(null);

        try {
            await register(event as any);
        } catch (e) {
            expect(mockCreateUser).toHaveBeenCalledWith({
                data: {
                    email: 'john@example.com',
                    emailVerified: false,
                    marketingAgreement: false,
                    passwordHash: 'hashed',
                    role: {
                        connect: {
                            name: 'USER',
                        },
                    },
                    userAuthToken: 'uuid',
                    username: 'john',
                },
            });
        }
    });

    it('redirects to verification page on successful registration', async () => {
        const event = mockRequestWithFormData({});
        mockFindUniqueRole.mockResolvedValue(null);
        mockFindFirstUser.mockResolvedValue(null);

        try {
            await register(event as any);
        } catch (e) {
            expect(mockCreateRole).toHaveBeenCalledWith({ data: { name: 'USER' } });
            expect(mockCreateUser).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({}),
                }),
            );
            expect(sendVerificationToken).toHaveBeenCalled();
            expect(e).toMatchObject({
                status: 303,
                location: '/verification-mail-sent',
            });
        }
    });

    it('does not create user if validation fails', async () => {
        vi.mocked(validateRegisterFormData).mockReturnValue({ emailInvalid: true });
        const event = mockRequestWithFormData({});

        const result = await register(event as any);
        expect(result).toMatchInlineSnapshot(`
        ActionFailure {
          "data": {
            "emailInvalid": true,
          },
          "status": 400,
        }
        `);
        expect(mockCreateUser).not.toHaveBeenCalled();
    });

    it('does not create user if username exists', async () => {
        mockFindUniqueUser.mockResolvedValue({ username: 'existing' });
        const event = mockRequestWithFormData({});

        const result = await register(event as any);
        expect(result).toMatchInlineSnapshot(`
        ActionFailure {
          "data": {
            "userExists": true,
          },
          "status": 400,
        }
        `);
        expect(db.user.create).not.toHaveBeenCalled();
    });

    it('does not create user if email exists in production', async () => {
        vi.mocked(validateRegisterFormData).mockReturnValue(null);
        vi.mocked(isString).mockReturnValue(true);
        vi.mocked(isProduction).mockReturnValue(true);

        mockFindUniqueUser.mockResolvedValue(null);

        const event = mockRequestWithFormData({});
        await register(event as any);

        expect(mockCreateUser).not.toHaveBeenCalled();
    });

    it('creates role if not exists before user creation', async () => {
        vi.mocked(validateRegisterFormData).mockReturnValue(null);
        vi.mocked(isString).mockReturnValue(true);

        const event = mockRequestWithFormData({});

        try {
            await register(event as any);
        } catch (e) {
            expect(e).toMatchObject({
                status: 303,
                location: '/verification-mail-sent',
            });
            expect(db.roles.create).toHaveBeenCalledWith({ data: { name: 'USER' } });
            expect(db.user.create).toHaveBeenCalled();
        }
    });

    it('throws error if sendVerificationToken fails', async () => {
        vi.mocked(validateRegisterFormData).mockReturnValue(null);
        vi.mocked(isString).mockReturnValue(true);
        vi.mocked(isProduction).mockReturnValue(true);
        vi.mocked(to).mockReturnValue(
            new Promise((resolve) => resolve([new Error('test error message'), undefined])),
        );

        const event = mockRequestWithFormData({});

        try {
            await register(event as any);
        } catch (e) {
            expect(e).toMatchObject({
                status: 500,
                body: { message: 'Verification email not sent' },
            });
        }
    });
});
