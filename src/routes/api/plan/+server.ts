import { createCompletion } from '$lib/server/openai';
import type { ChatMessage } from '@/models/open-ai/chat-gpt.model';
import { appConfig } from '@/constants/app.constants';
import { addPlan, updateGeneratedPlansNumber } from '$lib/prisma/prisma';

export async function POST({ request }: { request: Request }): Promise<Response> {
    const body = await request.json();
    const messages: Array<ChatMessage> = body.messages;
    const generatedPlansNumber: number = body.user.generatedPlansNumber;
    const userId = body.user.id;

    if (generatedPlansNumber > appConfig.planLimit) {
        // TODO: add error handling
        return new Response(JSON.stringify({ error: 'No plans left' }), { status: 400 });
    }

    const planDescription = await createCompletion(messages);

    const plan = {
        name: 'Plan ' + generatedPlansNumber,
        description: planDescription,
        User: {
            connect: {
                id: userId,
            },
        },
    };

    const generatedPlan = await addPlan(plan);
    const newGeneratedPlansNumber = await updateGeneratedPlansNumber(userId);

    const responseBody = {
        generatedPlan: generatedPlan,
        generatedPlansNumber: newGeneratedPlansNumber,
    };

    return new Response(JSON.stringify(responseBody), {
        headers: { 'Content-Type': 'application/json' },
    });
}
