import {
    ClipboardIcon,
    ToolIcon,
    CheckCircleIcon,
    RotateCwIcon,
    ListIcon,
    BatteryChargingIcon,
    PieChartIcon,
    TrendingUpIcon,
    SmileIcon,
    BarChart2Icon,
    ShieldIcon,
} from 'svelte-feather-icons';

export const howItWorksItems = [
    {
        verticalLabel: 'User',
        title: 'DATA GATHERING',
        description: 'User enters details on current health status, training level, goals and available equipment',
        icon: ClipboardIcon,
    },
    {
        verticalLabel: 'System',
        title: 'PROMPT COMPOSING',
        description: 'App builds a prompt based on user data and guidelines for creating plans',
        icon: ToolIcon,
    },
    {
        verticalLabel: 'AI model',
        title: 'CRAFTING',
        description: 'App sends prepared prompt to the generative AI model which crafts a training plan',
        icon: RotateCwIcon,
    },
    {
        verticalLabel: 'System',
        title: 'PROCESSING',
        description: 'The generated plan is processed and formatted to be delivered to the user in its final form',
        icon: CheckCircleIcon,
    },
];

export const trainingComponentItems = [
    {
        title: 'Consistency',
        description:
            'Consistently following the training plan and adhering to nutritional guidelines is essential for progress',
        icon: ListIcon,
    },
    {
        title: 'Proper technique',
        description:
            'Proper form ensures that force is evenly distributed across muscles and joints, reducing injury risk',
        icon: CheckCircleIcon,
    },
    {
        title: 'Recovery',
        description: 'Rest and recovery are crucial for muscle repair, preventing injury, and overall performance',
        icon: BatteryChargingIcon,
    },
    {
        title: 'Nutrition',
        description: 'Proper nutrition fuels workouts, aids recovery, and supports muscle growth or fat loss',
        icon: PieChartIcon,
    },
    {
        title: 'Progression',
        description:
            'Gradually increasing the intensity, volume, or difficulty of workouts to keep challenging the body',
        icon: TrendingUpIcon,
    },
    {
        title: 'Variety',
        description: 'Including different workout types to avoid plateaus and maintain engagement',
        icon: BarChart2Icon,
    },
    {
        title: 'Mindset',
        description: 'Mental resilience and staying motivated are important for overcoming challenges',
        icon: SmileIcon,
    },
    {
        title: 'Injury prevention',
        description:
            'Incorporating warm-ups, cool-downs, stretching, and mobility exercises to reduce the risk of injuries',
        icon: ShieldIcon,
    },
];

export const faqItems = [
    {
        title: 'Is it free?',
        content: 'Yes the application is free, although the number of plans generated by one user is limited to 3.',
    },
    {
        title: 'Is there a premium plan?',
        content:
            'At this point there are no paid premium plans but it is possible that they will appear as the app develops.',
    },
    {
        title: 'What AI model is used to generate the plans?',
        content: 'GymCraft is currently using the gpt-4o model by OpenAI.',
    },
    {
        title: 'Will new features be added in the future?',
        content:
            'Yes, the application is still in the early stages of development. The plan is to add the ability to create plans targeted by sport.',
    },
];
