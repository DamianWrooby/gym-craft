import { SECRET_INTERNAL_GARMIN_API_URL, SECRET_INTERNAL_API_KEY } from '$env/static/private';

export const garminApiUrl = SECRET_INTERNAL_GARMIN_API_URL;

export function garminApiHeaders(): Record<string, string> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (SECRET_INTERNAL_API_KEY) {
        headers['X-API-Key'] = SECRET_INTERNAL_API_KEY;
    }
    return headers;
}

export function garminApiKeyHeader(): Record<string, string> {
    if (SECRET_INTERNAL_API_KEY) {
        return { 'X-API-Key': SECRET_INTERNAL_API_KEY };
    }
    return {};
}

/**
 * Headers for an authenticated Garmin microservice call: the service-level X-API-Key plus the
 * user's opaque session token as a Bearer. The Bearer token is the sole user identity — the
 * microservice ignores any username/password in the body.
 */
export function garminBearerHeaders(sessionToken: string): Record<string, string> {
    return { ...garminApiHeaders(), Authorization: `Bearer ${sessionToken}` };
}

/** Multipart variant (no Content-Type — fetch sets the multipart boundary itself). */
export function garminBearerKeyHeaders(sessionToken: string): Record<string, string> {
    return { ...garminApiKeyHeader(), Authorization: `Bearer ${sessionToken}` };
}
