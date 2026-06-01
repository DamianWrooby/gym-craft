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
