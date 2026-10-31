import { describe, expect, it } from 'vitest';
import { readApiError } from './api-error';

const res = (body: string, status = 400) => new Response(body, { status });

describe('readApiError', () => {
    it('reads message and code', async () => {
        expect(await readApiError(res('{"message":"Plan not found","code":"NOT_FOUND"}'), 'x')).toEqual({
            message: 'Plan not found',
            code: 'NOT_FOUND',
        });
    });

    it('falls back when the body is not JSON, empty, or has no message', async () => {
        expect(await readApiError(res('<html>502</html>', 502), 'Server error')).toEqual({ message: 'Server error' });
        expect(await readApiError(res(''), 'Server error')).toEqual({ message: 'Server error' });
        expect(await readApiError(res('{"error":"old shape"}'), 'Server error')).toEqual({ message: 'Server error' });
        expect(await readApiError(res('"just a string"'), 'Server error')).toEqual({ message: 'Server error' });
    });
});
