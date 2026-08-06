import { describe, expect, it } from 'vitest';
import crypto from 'crypto';

import { load } from './+page.server';

const sha256 = (value: string) => crypto.createHash('sha256').update(value).digest('hex');

function event({ emailVerified = true, session }: { emailVerified?: boolean; session?: string }) {
    return {
        locals: { user: { emailVerified } },
        cookies: { get: (name: string) => (name === 'session' ? session : undefined) },
    } as never;
}

describe('create-plan +page.server load', () => {
    // The proxy matches this value against User.userAuthToken, which stores the hash — sending the
    // raw cookie instead would both fail the lookup and put a replayable credential in the page.
    it('exposes the hashed session, never the raw cookie', async () => {
        const result = await load(event({ session: 'raw-cookie-value' }));

        expect(result.proxySession).toBe(sha256('raw-cookie-value'));
        expect(result.proxySession).not.toBe('raw-cookie-value');
    });

    it('returns null when there is no session cookie', async () => {
        const result = await load(event({}));

        expect(result.proxySession).toBeNull();
    });

    it('redirects an unverified user away before touching the cookie', async () => {
        await expect(load(event({ emailVerified: false, session: 'raw' }))).rejects.toMatchObject({
            status: 302,
            location: '/app',
        });
    });
});
