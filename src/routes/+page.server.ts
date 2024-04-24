import { PUBLIC_APP_ENV } from '$env/static/public';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
    // console.log(event);
    console.log(`env: ${PUBLIC_APP_ENV}`);
};
