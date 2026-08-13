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
import { TIER_LIMITS } from '@/constants/subscription.constants';

const { FREE, SUPPORTER } = TIER_LIMITS;

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

// Caps are interpolated from TIER_LIMITS so this copy cannot drift from the gating that
// actually runs. Prices are literal because they live in Stripe, not in TIER_LIMITS. The
// free gym-plan cap is deliberately vague: it comes from the `generalPlanLimit`
// Configuration row in the database, which this prerendered page cannot read.
export const faqItems = [
    {
        title: 'Is it free?',
        content: `Yes. The free tier lets you generate AI workout plans, connect your Garmin account and sync your activities, and gives you ${FREE.weeklyReportsPerMonth} AI weekly reports a month plus ${FREE.explainRunsPerDay} run explanation a day. The number of gym plans a free account can generate is capped.`,
    },
    {
        title: 'Is there a paid plan?',
        content: `There is an optional Supporter tier — €4 a month, €36 a year, or €25 once for lifetime access. It raises the AI limits to ${SUPPORTER.weeklyReportsPerMonth} weekly reports and ${SUPPORTER.gymPlansPerMonth} gym plans a month plus ${SUPPORTER.explainRunsPerDay} run explanations a day, uses a more capable AI model, extends the Garmin history import from ${FREE.garminBackfillDays} to ${SUPPORTER.garminBackfillDays} days, and unlocks report export. GymCraft is a hobby project — the tier exists to cover its running costs, not to lock away the basics.`,
    },
    {
        title: 'Do I need a Garmin watch?',
        content:
            'Not for the gym side — AI workout plans work without any device. Running analytics does need a Garmin account, because GymCraft reads the activities you have already recorded from Garmin Connect. Other platforms are not supported yet.',
    },
    {
        title: 'Do my rides and swims count, or only runs?',
        content:
            'They count. Training load is calculated from every activity you record — runs, rides, swims, hikes — because cardiovascular stress accumulates regardless of the sport. Distance is a different matter: it is reported per sport and never added together, since a kilometre swum is not a kilometre run.',
    },
    {
        title: 'What is training load and ACWR?',
        content:
            'Every activity is turned into a TRIMP score from your heart rate and how long you trained. ACWR compares the average daily load of your last 7 days against your last 28 — your recent work against the base you have built. Ramp up too quickly and GymCraft flags the risk before you feel it.',
    },
    {
        title: 'Which AI model does GymCraft use?',
        content:
            'GymCraft runs on OpenAI models. Free accounts use a fast, cost-efficient model; Supporters get the more capable one for weekly reports and run analysis. Models are upgraded as better ones ship.',
    },
    {
        title: 'Is GymCraft still being developed?',
        content:
            'Yes. Training-load analytics, coach-style weekly AI reports and Garmin activity sync are the most recent additions. New features land regularly, and the free tier gets them too.',
    },
];
