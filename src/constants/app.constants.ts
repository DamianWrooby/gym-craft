export enum appConfig {
    name = 'Gym Craft',
    baseUrlDEV = 'http://localhost:5173',
    baseUrlPROD = 'https://gym-craft.netlify.app',
    openAIapiUrl = 'https://api.openai.com/v1/chat/completions',
    proxyApiUrlDEV = 'http://localhost:3000/api/generate-plan',
    proxyApiUrlPROD = 'https://gym-craft-ai-proxy.onrender.com/api/generate-plan',
    plansApiUrl = '/api/plans',
    generalPlanLimitApiUrl = '/api/general-plan-limit',
    administratorEmail = 'dwroblewski89@gmail.com',
    model = 'gpt-4o',
    openAIcompletionSeed = 1,
    openAIcompletionTemperature = 0.2,
    planLimit = 10,
}

export const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;