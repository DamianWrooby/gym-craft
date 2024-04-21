import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
    // console.log(event);
    console.log(`context: ${process.env.CONTEXT}`);
};
