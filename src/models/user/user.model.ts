export interface User {
    id: string;
    name: string;
    email: string;
    emailVerified: boolean;
    marketingAgreement: boolean;
    role: string;
    generatedPlansNumber: number;
    plansLeft: number;
    session: string;
}
