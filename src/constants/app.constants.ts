export enum appConfig {
    name = 'Gym Craft',
    baseUrlDEV = 'http://localhost:5173',
    baseAppUrlDEV = 'http://localhost:5173/app',
    baseUrlPROD = 'https://gym-craft.netlify.app',
    baseAppUrlPROD = 'https://gym-craft.netlify.app/app',
    openAIapiUrl = 'https://api.openai.com/v1/chat/completions',
    proxyApiUrlDEV = 'http://localhost:3000/api/generate-plan',
    proxyApiUrlPROD = 'https://gym-craft-ai-proxy.onrender.com/api/generate-plan',
    internalGarminApiUrl = 'https://gymcraft-python-connect.onrender.com/upload-workout',
    plansApiUrl = '/api/plans',
    generalPlanLimitApiUrl = '/api/general-plan-limit',
    administratorEmail = 'dwroblewski89@gmail.com',
    model = 'gpt-4o-mini',
    openAIcompletionSeed = 1,
    openAIcompletionTemperature = 0.2,
    planLimit = 10,
}

export const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;