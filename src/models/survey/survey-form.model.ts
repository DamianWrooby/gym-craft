export interface SurveyFormModel {
    personalInfo: PersonalInfoModel;
    goals: GoalsModel;
    experience: ExperienceModel;
    lifestyle: LifestyleModel;
    fitnessLevel: FitnessLevelModel;
    equipment: EquipmentModel;
}

export interface PersonalInfoModel {
    sex: string;
    age: number;
    height: number;
    weight: number;
    medicalConditions: string;
}

export interface GoalsModel {
    mainGoals: GoalOptionsModel;
    otherGoalsDescription: string;
}

export interface GoalOptionsModel {
    [key: string]: boolean;
}

export interface ExperienceModel {
    activityLevel: string;
    activityHistory: string;
    enjoyedExercises: string;
    dislikedExercises: string;
}

export interface LifestyleModel {
    job: string;
    hourCapacity: string;
    timePreferences: string;
    trainingDays: {
        [key: string]: boolean;
    };
}

export interface FitnessLevelModel {
    fitnessLevel: number;
    currentActivities: string;
    physicalLimitations: string;
}

export interface EquipmentModel {
    freeWeights: boolean;
    trainingMachines: boolean;
    treadmill: boolean;
    rowingMachine: boolean;
    stationaryBike: boolean;
    elliptical: boolean;
    stairMaster: boolean;
    resistanceBands: boolean;
    trx: boolean;
    calisthenics: boolean;
    mtbBike: boolean;
    roadBike: boolean;
}
