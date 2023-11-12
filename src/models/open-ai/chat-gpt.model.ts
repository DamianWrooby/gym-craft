export interface ChatCompletion {
    id: string;
    object: string;
    created: number;
    model: string;
    choices: [
        {
            index: number;
            message: ChatMessage;
            finish_reason: string;
        },
    ];
    usage: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    };
}

export interface ChatMessage {
    role: string;
    content: string;
}
