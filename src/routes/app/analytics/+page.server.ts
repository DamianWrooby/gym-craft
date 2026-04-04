import { redirect } from '@sveltejs/kit';

export async function load({ locals }) {
    const user = locals?.user;

    if (!user.emailVerified) throw redirect(302, '/app');
}
