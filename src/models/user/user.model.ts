export interface User {
	id: string;
	name: string;
	email: string;
	emailVerified: boolean;
	role: string;
	generatedPlansNumber: number;
	plansLeft: number;
	session: string;
}