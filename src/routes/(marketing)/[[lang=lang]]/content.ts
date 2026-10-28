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
import { m } from '$lib/paraglide/messages.js';
import { TIER_LIMITS } from '@/constants/subscription.constants';

const { FREE, SUPPORTER } = TIER_LIMITS;

// Functions, not constants: each prerendered page reads the copy in its own URL's locale (ADR 0028).

export const howItWorksItems = () => [
    { verticalLabel: m.mk_how_user(), title: m.mk_how1_title(), description: m.mk_how1(), icon: ClipboardIcon },
    { verticalLabel: m.mk_how_system(), title: m.mk_how2_title(), description: m.mk_how2(), icon: ToolIcon },
    { verticalLabel: m.mk_how_ai(), title: m.mk_how3_title(), description: m.mk_how3(), icon: RotateCwIcon },
    { verticalLabel: m.mk_how_system(), title: m.mk_how4_title(), description: m.mk_how4(), icon: CheckCircleIcon },
];

export const trainingComponentItems = () => [
    { title: m.mk_tc_consistency(), description: m.mk_tc_consistency_d(), icon: ListIcon },
    { title: m.mk_tc_technique(), description: m.mk_tc_technique_d(), icon: CheckCircleIcon },
    { title: m.mk_tc_recovery(), description: m.mk_tc_recovery_d(), icon: BatteryChargingIcon },
    { title: m.mk_tc_nutrition(), description: m.mk_tc_nutrition_d(), icon: PieChartIcon },
    { title: m.mk_tc_progression(), description: m.mk_tc_progression_d(), icon: TrendingUpIcon },
    { title: m.mk_tc_variety(), description: m.mk_tc_variety_d(), icon: BarChart2Icon },
    { title: m.mk_tc_mindset(), description: m.mk_tc_mindset_d(), icon: SmileIcon },
    { title: m.mk_tc_injury(), description: m.mk_tc_injury_d(), icon: ShieldIcon },
];

// Caps are interpolated from TIER_LIMITS so this copy cannot drift from the gating that
// actually runs. Prices are literal because they live in Stripe, not in TIER_LIMITS. The
// free gym-plan cap is deliberately vague: it comes from the `generalPlanLimit`
// Configuration row in the database, which this prerendered page cannot read.
export const faqItems = () => [
    {
        title: m.mk_faq1_q(),
        content: m.mk_faq1_a({ reports: FREE.weeklyReportsPerMonth, explains: FREE.explainRunsPerDay }),
    },
    {
        title: m.mk_faq2_q(),
        content: m.mk_faq2_a({
            reports: SUPPORTER.weeklyReportsPerMonth,
            plans: SUPPORTER.gymPlansPerMonth ?? 0,
            explains: SUPPORTER.explainRunsPerDay,
            freeDays: FREE.garminBackfillDays,
            days: SUPPORTER.garminBackfillDays,
        }),
    },
    { title: m.mk_faq3_q(), content: m.mk_faq3_a() },
    { title: m.mk_faq4_q(), content: m.mk_faq4_a() },
    { title: m.mk_faq5_q(), content: m.mk_faq5_a() },
    { title: m.mk_faq6_q(), content: m.mk_faq6_a() },
    { title: m.mk_faq7_q(), content: m.mk_faq7_a() },
];
