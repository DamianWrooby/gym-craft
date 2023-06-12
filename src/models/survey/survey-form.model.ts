export interface SurveyFormModel {
    personalInfo: PersonalInfoModel;
    goals: GoalsModel;
    experience: ExperienceModel;
}

interface PersonalInfoModel {
    sex: string;
    age: number;
    height: number;
    weight: number;
    medicalConditions: string;
}

interface GoalsModel {
    goals: string;
    goalsDescription: string;
}

interface ExperienceModel {
    activityLevel: string;
    activityHistory: string;
    enjoyedExercises: string;
    dislikedExercises: string;
}
