export enum appConfig {
    name = 'Gym Craft',
    baseUrlDEV = 'http://localhost:5173',
    baseAppUrlDEV = 'http://localhost:5173/app',
    baseUrlPROD = 'https://gymcraft.damianwroblewski.com',
    baseAppUrlPROD = 'https://gymcraft.damianwroblewski.com/app',
    aiRequestApiUrlDEV = 'http://localhost:3000/api/ai-request',
    aiRequestApiUrlPROD = 'https://gym-craft-ai-proxy.onrender.com/api/ai-request',
    weeklyReportApiUrlDEV = 'http://localhost:3000/api/weekly-report',
    weeklyReportApiUrlPROD = 'https://gym-craft-ai-proxy.onrender.com/api/weekly-report',
    explainRunApiUrlDEV = 'http://localhost:3000/api/explain-run',
    explainRunApiUrlPROD = 'https://gym-craft-ai-proxy.onrender.com/api/explain-run',
    garminActivitiesApiUrlDEV = 'http://localhost:3000/api/garmin-activities',
    garminActivitiesApiUrlPROD = 'https://gym-craft-ai-proxy.onrender.com/api/garmin-activities',
    garminActivityDetailApiUrlDEV = 'http://localhost:3000/api/garmin-activity-detail',
    garminActivityDetailApiUrlPROD = 'https://gym-craft-ai-proxy.onrender.com/api/garmin-activity-detail',
    // Hit directly from the browser to wake the (free-tier, spin-down-prone) Garmin microservice
    // before syncing — Render only wakes it for residential IPs, not the proxy's datacenter IP.
    garminServiceWakeUrlPROD = 'https://gymcraft-curl-cffi.onrender.com/health',
    generalPlanLimitApiUrl = '/api/general-plan-limit',
    administratorEmail = 'dwroblewski89@gmail.com',
    planLimit = 10,
}

export const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
