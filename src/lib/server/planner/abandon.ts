// Abandon the active plan (#435): the athlete starts again from the wizard. The rows stay, state
// ABANDONED, so done sessions keep their activity links. A new plan writes a paid week-1 request,
// so abandoning costs one `plan_revision` (ADR 0016): an abandon-and-recreate loop is open-ended.
import { db } from '$lib/database';
import { currentMonthStartIso } from '$lib/utils/iso-week';
import { getLimit, type SubscriptionTier } from '@/constants/subscription.constants';
import { revisionsUsed } from './revision';

export type AbandonResult = { kind: 'abandoned' } | { kind: 'none' } | { kind: 'capped'; used: number; cap: number };

export async function abandonActivePlan(userId: string, tier: SubscriptionTier): Promise<AbandonResult> {
    const cap = getLimit(tier, 'planRevisionsPerMonth');
    const used = await revisionsUsed(userId);
    if (used >= cap) return { kind: 'capped', used, cap };

    const monthKey = currentMonthStartIso();
    return db.$transaction(async (tx) => {
        const abandoned = await tx.plan.updateMany({
            where: { userId, state: 'ACTIVE' },
            data: { state: 'ABANDONED' },
        });
        if (abandoned.count === 0) return { kind: 'none' as const };
        await tx.aiUsage.upsert({
            where: { userId_kind_day: { userId, kind: 'plan_revision', day: monthKey } },
            create: { userId, kind: 'plan_revision', day: monthKey, count: 1 },
            update: { count: { increment: 1 } },
        });
        return { kind: 'abandoned' as const };
    });
}
