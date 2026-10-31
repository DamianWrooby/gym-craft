import { describe, expect, it } from 'vitest';
import { classifyGarminFailure } from './garmin-failure';

describe('classifyGarminFailure', () => {
    it('treats a throttle as RATE_LIMITED, even with a 401-style message', () => {
        expect(classifyGarminFailure(429, { message: 'No valid token found' })).toBe('RATE_LIMITED');
        expect(classifyGarminFailure(500, { code: 'RATE_LIMITED' })).toBe('RATE_LIMITED');
    });

    it('detects an unusable token by status, code, or legacy message', () => {
        expect(classifyGarminFailure(401, null)).toBe('INVALID_TOKEN');
        expect(
            classifyGarminFailure(400, {
                code: 'INVALID_TOKEN',
                message: 'stored Garmin authorization is no longer usable',
            }),
        ).toBe('INVALID_TOKEN');
        expect(classifyGarminFailure(500, { message: 'No valid token found' })).toBe('INVALID_TOKEN');
    });

    it('maps 504 to TIMEOUT and anything else to OTHER', () => {
        expect(classifyGarminFailure(504, null)).toBe('TIMEOUT');
        expect(classifyGarminFailure(500, { message: 'boom' })).toBe('OTHER');
        expect(classifyGarminFailure(undefined, undefined)).toBe('OTHER');
    });
});
