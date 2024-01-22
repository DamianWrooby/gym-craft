import type { SurveyFormModel } from '@/models/survey/survey-form.model';
import type { ChatMessage } from '@/models/open-ai/chat-gpt.model';

export const generateAPIMessages = (formData: SurveyFormModel): Array<ChatMessage> => {
    const mainGoalsText = generateMainGoalsText(formData);
    const daysOfWeekText = generateDaysOfWeekText(formData);
    const equipmentText = generateEquipmentText(formData);

    const systemRoleMessage = {
        role: 'system',
        content:
            'Act like expierenced personal trainer with 10+ years of expierence in creating training plans for the clients.',
    };
    const taskMessage = {
        role: 'user',
        content:
            'Prepare a complete training plan for me based on the information I present below.',
    };
    const informationMessages = [
        {
            role: 'user',
            content: `Personal information:
            Sex: ${formData.personalInfo.sex}
            Age: ${formData.personalInfo.age}
            Height: ${formData.personalInfo.height} cm
            Weight: ${formData.personalInfo.weight} kg
            Medical conditions: ${formData.personalInfo.medicalConditions}
            
            The main goals I want to achieve through training:
            ${mainGoalsText}
            
            My experience in training:
            My fitness activity experience: ${formData.experience.activityLevel}
            Fitness activities I have been involved in the past: ${formData.experience.activityHistory}
            Excersises I enjoy: ${formData.experience.enjoyedExercises}
            Excersises I don't like: ${formData.experience.dislikedExercises}
            
            Lifestyle:
            Job type: ${formData.lifestyle.job}
            Time I can spend on training: ${formData.lifestyle.hourCapacity}/week
            Training time preferences: ${formData.lifestyle.timePreferences}
            Days of the week I can train: ${daysOfWeekText}
            
            My current fitness level:
            How do I rate my fitness level on a scale of 1-10: ${formData.fitnessLevel.fitnessLevel},
            Physical activities I am currently engaged in: ${formData.fitnessLevel.currentActivities}
            My physical limitations and restrictions that must be taken into account when creating the plan: ${formData.fitnessLevel.physicalLimitations}
            
            Equipment:
            Equipment I have access to: ${equipmentText}

            Additional information:
            Length of the training cycle: ${formData.additionalInfo.cycleLength} weeks`,
        },
    ];
    const formatMessage = {
        role: 'user',
        content:
            'Based on the information above, prepare a detailed training plan with a breakdown of days of the week, exercises, sets and repetitions. Include training periodization and progression. Also add a general description of the training plan with justification for the choice of exercises. Format the plan using HTML tags. It will be displayed in the application so you don;t need to include html, head and body tags. Start with the <h2> tag. To every h2 tag include CSS classes: "h2 text-xl py-2". To every h3 tag include CSS classes: "h3 text-lg py-2".',
    };

    const messages: Array<ChatMessage> = [
        systemRoleMessage,
        taskMessage,
        ...informationMessages,
        formatMessage,
    ];
    return messages;
};

const generateMainGoalsText = (formData: SurveyFormModel): string => {
    const mainGoals: string[] = Object.entries(formData.goals.mainGoals)
        .filter(([, value]) => value === true)
        .map(([key]) => key);
    const mainGoalsText = mainGoals.map((text) => text.replaceAll('-', ' ')).join(', ');
    if (mainGoals.includes('other')) {
        mainGoalsText.concat(`, ${formData.goals.otherGoalsDescription}`);
    }
    return mainGoalsText;
};

const generateDaysOfWeekText = (formData: SurveyFormModel): string =>
    Object.entries(formData.lifestyle.trainingDays)
        .filter(([, value]) => value === true)
        .map(([key]) => key)
        .map(capitalizeWord)
        .join(', ');

const generateEquipmentText = (formData: SurveyFormModel): string =>
    // TODO: second word is not capitalized
    Object.entries(formData.equipment)
        .filter(([, value]) => value === true)
        .map(([key]) => key)
        .map(separateCamelCase)
        .join(', ');

const capitalizeWord = (word: string): string =>
    word.replace(/\b\w/g, (char) => char.toUpperCase());

const separateCamelCase = (word: string) => word.replace(/([A-Z])/g, ' $1').trim();
