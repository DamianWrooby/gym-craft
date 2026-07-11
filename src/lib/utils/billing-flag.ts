import { PUBLIC_BILLING_ENABLED } from '$env/static/public';

// Master switch for Supporter purchases. When false the app keeps the full tier
// system (caps, tier resolution, existing supporters) but removes every path to
// buy: no checkout buttons, no upgrade CTAs, checkout endpoint returns 503.
export const billingEnabled = PUBLIC_BILLING_ENABLED === 'true';
