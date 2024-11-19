import { appConfig } from '../../src/constants/app.constants';
import { createCompletion } from '../../src/lib/server/openai';
import { addPlan, getGeneralPlanLimit, updateGeneratedPlansNumber } from '../../src/lib/prisma/prisma';
import type { Config } from '@netlify/edge-functions';
import type { ChatMessage } from '../../src/models/open-ai/chat-gpt.model';
import { createResponse } from '../../src/lib/utils/response';
import { json } from '@sveltejs/kit';

export default async (request: Request) => {
    // Retrieve the request body data
    const requestBody = await request.json();
    const { messages }: { messages: Array<ChatMessage> } = requestBody;
    const generatedPlansNumber: number = requestBody.user.generatedPlansNumber;
    const userId = requestBody.user.id;

    // Retrieve the general plan limit from DB
    const generalPlanLimit = await getGeneralPlanLimit();

    // Check if the user has reached the plan limit
    if (generatedPlansNumber >= generalPlanLimit) {
        return createResponse(400, { message: 'No plans left' });
    }

    const body = new ReadableStream({
        async start(controller) {
            // Create a plan description using OpenAI API
            const planDescription = await createCompletion(messages);

            // Create a new plan object
            const plan = {
                name: 'Plan ' + generatedPlansNumber,
                description: planDescription,
                User: {
                    connect: {
                        id: userId,
                    },
                },
            };

			// Add the plan to the DB and update the generated plans number
            const generatedPlan = await addPlan(userId, plan);
            const newGeneratedPlansNumber = await updateGeneratedPlansNumber(userId);
            const plansLeft =
                typeof newGeneratedPlansNumber === 'number' ? generalPlanLimit - newGeneratedPlansNumber : 0;

			// Prepare the response body
			const responseBody = {
				generatedPlan: generatedPlan,
				generatedPlansNumber: newGeneratedPlansNumber,
				plansLeft,
			};

			controller.enqueue(json(responseBody));
			controller.close();
        },
    });
    return new Response(body, {
        headers: {
            'Content-Type': 'application/json',
        },
    });
};

export const config: Config = { path: appConfig.plansApiUrl };
