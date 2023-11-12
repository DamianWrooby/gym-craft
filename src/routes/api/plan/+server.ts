import { createCompletion } from '$lib/server/openai';

export async function POST({ request }: { request: Request }) {
    const messages = await request.json();
    const response = await createCompletion(messages);

    return new Response(JSON.stringify(response));
}
