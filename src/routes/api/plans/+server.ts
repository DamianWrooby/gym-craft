import { createCompletion } from '$lib/server/openai';
import type { ChatMessage } from '@/models/open-ai/chat-gpt.model';
import { appConfig } from '@/constants/app.constants';
import { addPlan, updateGeneratedPlansNumber } from '$lib/prisma/prisma';
import { createErrorResponse } from '$lib/utils/error-response';
import { json } from '@sveltejs/kit';

export async function POST({ request }: { request: Request }): Promise<Response> {
    const body = await request.json();
    const messages: Array<ChatMessage> = body.messages;
    const generatedPlansNumber: number = body.user.generatedPlansNumber;
    const userId = body.user.id;

    if (generatedPlansNumber > appConfig.planLimit) {
        return createErrorResponse(400, 'No plans left');
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

    return json(responseBody);
}
