import { updatePlanName } from '$lib/prisma/prisma';

export async function POST({ request, params }: { request: Request; params: { id: string } }): Promise<Response> {
    const body = await request.json();
    let updatedPlan;

    if (!params.id) {
        throw new Error('Invalid plan ID');
    }

    try {
        updatedPlan = await updatePlanName(params.id, body.name);
    } catch (error) {
        throw new Error(error as string);
    }

    return new Response(JSON.stringify(updatedPlan), {
        headers: { 'Content-Type': 'application/json' },
    });
}
