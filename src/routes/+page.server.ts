import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
    // console.log(event);
    console.log(`env: ${process.env.NODE_ENV}`);
};
