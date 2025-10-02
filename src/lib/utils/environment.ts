import { PUBLIC_APP_ENV } from '$env/static/public';

export function isProduction(): boolean {
    return PUBLIC_APP_ENV === 'production';
}
