import { createCompletion } from '$lib/server/openai';
import type { ChatMessage } from '@/models/open-ai/chat-gpt.model';
import { appConfig } from '@/constants/app.constants';
import { incrementUserGeneretedPlans, addPlan } from '$lib/prisma/prisma';

export async function POST({ request }: { request: Request }) {
    const body = await request.json();
    const messages: Array<ChatMessage> = body.messages;
    const generatedPlans: number = body.user.generatedPlans;
    const userId = body.user.id;

    if (generatedPlans > appConfig.planLimit) {
        // TODO: add error handling
        return new Response(JSON.stringify({ error: 'No plans left' }), { status: 400 });
    }

    const planDescription = await createCompletion(messages);

    const plan = {
        name: 'Plan ' + generatedPlans,
        description: planDescription,
        User: {
            connect: {
                id: userId,
            },
        },
    };

    const generatedPlan = await addPlan(plan);
    await incrementUserGeneretedPlans(userId);

    return new Response(JSON.stringify(generatedPlan));
}
