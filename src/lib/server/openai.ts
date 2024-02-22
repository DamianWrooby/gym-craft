import { SECRET_OPENAI_KEY } from '$env/static/private';
import { appConfig } from '@/constants/app.constants';
import type { ChatMessage } from '@/models/open-ai/chat-gpt.model';

import type { ChatCompletion } from '@/models/open-ai/chat-gpt.model';

export const createCompletion = async (messages: Array<ChatMessage>) => {
    const { openAIapiUrl } = appConfig;

    const response = await fetch(openAIapiUrl, {
        method: 'POST',
        headers: new Headers({
            'Content-Type': 'application/json',
            Authorization: `Bearer ${SECRET_OPENAI_KEY}`,
        }),
        body: JSON.stringify({
            model: appConfig.model,
            seed: appConfig.openAIcompletionSeed,
            temperature: appConfig.openAIcompletionTemperature,
            messages,
        }),
    });

    if (!response.ok) {
        throw new Error(`Could not connect to OpenAI API`);
    }

    const json = await response.json();

    if (!isChatCompletion(json)) {
        throw new Error(`Unexpected response from OpenAI`);
    }

    return json.choices[0].message.content;
};

const isChatCompletion = (data: unknown): data is ChatCompletion =>
    typeof data === 'object' && !!(data as ChatCompletion).choices?.[0].message?.content;
