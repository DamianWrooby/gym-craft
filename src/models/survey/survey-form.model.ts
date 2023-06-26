export interface SurveyFormModel {
    personalInfo: PersonalInfoModel;
    goals: GoalsModel;
    experience: ExperienceModel;
    lifestyle: LifestyleModel;
    fitnessLevel: FitnessLevelModel;
    equipment: EquipmentModel;
}

interface PersonalInfoModel {
    sex: string;
    age: number;
    height: number;
    weight: number;
    medicalConditions: string;
}

interface GoalsModel {
    mainGoals: GoalOptionsModel;
    otherGoalsDescription: string;
}

interface GoalOptionsModel {
    [key: string]: boolean;
}

interface ExperienceModel {
    activityLevel: string;
    activityHistory: string;
    enjoyedExercises: string;
    dislikedExercises: string;
}

interface LifestyleModel {
    job: string;
    hourCapacity: string;
    timePreferences: string;
    trainingDays: {
        [key: string]: boolean;
    };
}

interface FitnessLevelModel {
    fitnessLevel: number;
    currentActivities: string;
    physicalLimitations: string;
}

interface EquipmentModel {
    equipment: {
        [key: string]: boolean;
    };
}
