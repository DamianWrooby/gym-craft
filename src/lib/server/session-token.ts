import crypto from 'crypto';

/**
 * Hashes a raw session cookie into the value stored in `User.userAuthToken`.
 *
 * This is the function that decides whether a session resolves, so it lives in exactly one place:
 * login writes the hash, logout rotates it, register seeds it, `updateUser()` looks the user up by
 * it, and create-plan hands it to the AI proxy. Five copies of the scheme meant five places to
 * miss when it changes.
 *
 * It sits in its own module rather than in `$lib/utils/user` so route files can hash a string
 * without pulling in the Prisma client.
 */
export function hashSessionToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
}
