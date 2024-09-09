import { db } from '$lib/database';

export async function updateUser(event) {
    const session = event.cookies?.get('session');

    if (!session) return;

    const user = await db.user.findUnique({
        where: { userAuthToken: session },
        select: {
            id: true,
            username: true,
            role: true,
            generatedPlansNumber: true,
            emailVerified: true,
            marketingAgreement: true,
            email: true,
        },
    });

    const configuration = await db.configuration.findFirst({
        where: { name: 'generalPlanLimit' },
        select: { value: true },
    });

    const plansLeft = configuration && user ? +configuration.value - user.generatedPlansNumber : 0;

    if (user) {
        const { id, username, role, generatedPlansNumber, emailVerified, marketingAgreement, email } = user;
        if (event.locals) {
            event.locals.user = {
                id,
                name: username,
                role: role.name,
                generatedPlansNumber,
                plansLeft,
                session,
                emailVerified,
                marketingAgreement,
                email,
            };
        }
    }
}
