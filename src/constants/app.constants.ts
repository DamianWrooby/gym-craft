export enum appConfig {
    name = 'Gym Craft',
    openAIapiUrl = 'https://api.openai.com/v1/chat/completions',
    proxyApiUrlDEV = 'http://localhost:3000/api/generate-plan',
    proxyApiUrlPROD = 'https://gym-craft-ai-proxy.onrender.com/api/generate-plan',
    plansApiUrl = '/api/plans',
    model = 'gpt-4o',
    openAIcompletionSeed = 1,
    openAIcompletionTemperature = 0.2,
    planLimit = 10,
}
