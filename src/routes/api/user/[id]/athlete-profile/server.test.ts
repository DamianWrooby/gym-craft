import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('$env/static/public', () => ({ PUBLIC_APP_ENV: 'test' }));

const mocks = vi.hoisted(() => ({
    getAthleteProfile: vi.fn(),
    upsertAthleteProfile: vi.fn(),
}));

vi.mock('$lib/prisma/prisma', () => mocks);

import { GET, PUT } from './+server';
import { validateAthleteProfileInput } from '$lib/server/athlete-profile/validation';

const userId = 'user-1';
const locals = { user: { id: userId } } as unknown as App.Locals;

function makeRequest(body: unknown): Request {
    return new Request('http://test/api/user/user-1/athlete-profile', {
        method: 'PUT',
        body: JSON.stringify(body),
    });
}

const validPayload = {
    birthDate: '1989-08-19',
    sex: 'MALE',
    weightKg: 80,
    heightCm: 180,
};

afterEach(() => {
    vi.clearAllMocks();
});

describe('GET /api/user/[id]/athlete-profile', () => {
    it('returns 403 when params.id does not match session user', async () => {
        const response = await GET({ params: { id: 'someone-else' }, locals });
        expect(response.status).toBe(403);
    });

    it('returns the profile when authorized', async () => {
        mocks.getAthleteProfile.mockResolvedValueOnce({ id: 'profile-1', userId });
        const response = await GET({ params: { id: userId }, locals });
        const json = await response.json();
        expect(response.status).toBe(200);
        expect(json.data).toEqual({ id: 'profile-1', userId });
    });

    it('returns null in data when profile does not exist', async () => {
        mocks.getAthleteProfile.mockResolvedValueOnce(null);
        const response = await GET({ params: { id: userId }, locals });
        const json = await response.json();
        expect(response.status).toBe(200);
        expect(json.data).toBeNull();
    });
});

describe('PUT /api/user/[id]/athlete-profile', () => {
    it('returns 403 when not the session user', async () => {
        const response = await PUT({
            request: makeRequest(validPayload),
            params: { id: 'someone-else' },
            locals,
        });
        expect(response.status).toBe(403);
        expect(mocks.upsertAthleteProfile).not.toHaveBeenCalled();
    });

    it('returns 400 when body is invalid', async () => {
        const response = await PUT({
            request: makeRequest({ ...validPayload, weightKg: -5 }),
            params: { id: userId },
            locals,
        });
        expect(response.status).toBe(400);
        expect(mocks.upsertAthleteProfile).not.toHaveBeenCalled();
    });

    it('upserts and returns the profile on a valid PUT', async () => {
        mocks.upsertAthleteProfile.mockResolvedValueOnce({ id: 'profile-1', userId });
        const response = await PUT({
            request: makeRequest(validPayload),
            params: { id: userId },
            locals,
        });
        const json = await response.json();
        expect(response.status).toBe(200);
        expect(json.data).toEqual({ id: 'profile-1', userId });
        expect(mocks.upsertAthleteProfile).toHaveBeenCalledWith(
            userId,
            expect.objectContaining({ sex: 'MALE', weightKg: 80, heightCm: 180, timezone: 'UTC' }),
        );
    });
});

describe('validateAthleteProfileInput', () => {
    it('accepts the minimal valid payload', () => {
        const result = validateAthleteProfileInput(validPayload);
        expect('input' in result).toBe(true);
    });

    it('rejects future birthDate', () => {
        const futureYear = new Date().getUTCFullYear() + 10;
        const result = validateAthleteProfileInput({ ...validPayload, birthDate: `${futureYear}-01-01` });
        expect('error' in result).toBe(true);
    });

    it('rejects bad birthDate format', () => {
        const result = validateAthleteProfileInput({ ...validPayload, birthDate: '1989/08/19' });
        expect('error' in result).toBe(true);
    });

    it('rejects unknown sex', () => {
        const result = validateAthleteProfileInput({ ...validPayload, sex: 'BANANA' });
        expect('error' in result).toBe(true);
    });

    it('rejects non-integer heightCm', () => {
        const result = validateAthleteProfileInput({ ...validPayload, heightCm: 180.5 });
        expect('error' in result).toBe(true);
    });

    it('rejects out-of-range weightKg', () => {
        const result = validateAthleteProfileInput({ ...validPayload, weightKg: 999 });
        expect('error' in result).toBe(true);
    });

    it('accepts and passes through optional fields when valid', () => {
        const result = validateAthleteProfileInput({
            ...validPayload,
            timezone: 'Europe/Warsaw',
            restingHR: 55,
            maxHR: 195,
            vo2max: 49.7,
            hrZoneBounds: [{ zone: 1, lowerBpm: 95, upperBpm: 134 }],
        });
        expect('input' in result).toBe(true);
        if ('input' in result) {
            expect(result.input.timezone).toBe('Europe/Warsaw');
            expect(result.input.restingHR).toBe(55);
            expect(result.input.maxHR).toBe(195);
            expect(result.input.vo2max).toBe(49.7);
            expect(result.input.hrZoneBounds).toEqual([{ zone: 1, lowerBpm: 95, upperBpm: 134 }]);
        }
    });

    it('rejects hrZoneBounds when not an array', () => {
        const result = validateAthleteProfileInput({ ...validPayload, hrZoneBounds: 'invalid' });
        expect('error' in result).toBe(true);
    });
});
