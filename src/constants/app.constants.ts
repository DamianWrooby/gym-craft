export enum appConfig {
    name = 'Gym Craft',
    openAIapiUrl = 'https://api.openai.com/v1/chat/completions',
    proxyApiUrlDEV = 'http://localhost:3000/api/generate-plan',
    proxyApiUrlPROD = '',
    plansApiUrl = '/api/plans',
    model = 'gpt-3.5-turbo',
    openAIcompletionSeed = 1,
    openAIcompletionTemperature = 0.2,
    planLimit = 10,
}
