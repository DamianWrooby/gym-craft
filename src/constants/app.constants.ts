export enum appConfig {
    name = 'Gym Craft',
    baseUrlDEV = 'http://localhost:5173',
    baseAppUrlDEV = 'http://localhost:5173/app',
    baseUrlPROD = 'https://gymcraft.damianwroblewski.com',
    baseAppUrlPROD = 'https://gymcraft.damianwroblewski.com/app',
    openAIapiUrl = 'https://api.openai.com/v1/chat/completions',
    proxyApiUrlDEV = 'http://localhost:3000/api/generate-plan',
    proxyApiUrlPROD = 'https://gym-craft-ai-proxy.onrender.com/api/generate-plan',
    weeklyReportApiUrlDEV = 'http://localhost:3000/api/weekly-report',
    weeklyReportApiUrlPROD = 'https://gym-craft-ai-proxy.onrender.com/api/weekly-report',
    explainRunApiUrlDEV = 'http://localhost:3000/api/explain-run',
    explainRunApiUrlPROD = 'https://gym-craft-ai-proxy.onrender.com/api/explain-run',
    garminActivitiesApiUrlDEV = 'http://localhost:3000/api/garmin-activities',
    garminActivitiesApiUrlPROD = 'https://gym-craft-ai-proxy.onrender.com/api/garmin-activities',
    // Hit directly from the browser to wake the (free-tier, spin-down-prone) Garmin microservice
    // before syncing — Render only wakes it for residential IPs, not the proxy's datacenter IP.
    garminServiceWakeUrlPROD = 'https://gymcraft-curl-cffi.onrender.com/health',
    plansApiUrl = '/api/plans',
    generalPlanLimitApiUrl = '/api/general-plan-limit',
    administratorEmail = 'dwroblewski89@gmail.com',
    model = 'gpt-5.4-mini',
    openAIcompletionSeed = 1,
    openAIcompletionTemperature = 0.2,
    planLimit = 10,
}

export const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
