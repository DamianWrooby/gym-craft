import type { SubscriptionTier } from '@/constants/subscription.constants';

export interface User {
    id: string;
    name: string;
    email: string;
    emailVerified: boolean;
    marketingAgreement: boolean;
    role: string;
    generatedPlansNumber: number;
    plansLeft: number;
    subscriptionTier: SubscriptionTier;
}
