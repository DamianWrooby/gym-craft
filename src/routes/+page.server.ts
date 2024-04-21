import { APP_ENV } from '$env/static/private';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
    // console.log(event);
    console.log(`env: ${APP_ENV}`);
};
