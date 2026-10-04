import { describe, expect, it } from 'vitest';
import { isInvalidTokenResponse } from './invalid-token';

describe('isInvalidTokenResponse', () => {
    it('matches a 401', () => {
        expect(isInvalidTokenResponse(401, null)).toBe(true);
    });

    it('matches the INVALID_TOKEN code with the new message', () => {
        expect(
            isInvalidTokenResponse(400, {
                code: 'INVALID_TOKEN',
                message: 'stored Garmin authorization is no longer usable',
            }),
        ).toBe(true);
    });

    it('matches the legacy message', () => {
        expect(isInvalidTokenResponse(500, { message: 'No valid token found' })).toBe(true);
    });

    it('ignores other errors', () => {
        expect(isInvalidTokenResponse(500, { message: 'Wrong workout format' })).toBe(false);
        expect(isInvalidTokenResponse(undefined, undefined)).toBe(false);
    });
});
