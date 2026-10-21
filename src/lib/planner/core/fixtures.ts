// Tune-up fixtures (ADR 0008): other dated goals inside the horizon become fixed hard days.
// Derived on read and shown as fixed sessions in their weeks; the week prompt schedules around them.

export interface FixtureGoal {
    id: string;
    date: string | null;
    name: string | null;
    distanceM: number | null;
}

export interface TuneUpFixture {
    goalId: string;
    date: string;
    name: string | null;
    distanceM: number | null;
    weekIndex: number;
}

export function tuneUpFixtures(input: {
    goals: FixtureGoal[];
    boundGoalId: string;
    startDate: string;
    endDate: string;
    weeks: { index: number; startDate: string; endDate: string }[];
}): TuneUpFixture[] {
    const { goals, boundGoalId, startDate, endDate, weeks } = input;
    const fixtures: TuneUpFixture[] = [];
    for (const g of goals) {
        if (g.id === boundGoalId || !g.date || g.date < startDate || g.date > endDate) continue;
        const week = weeks.find((w) => g.date! >= w.startDate && g.date! <= w.endDate);
        if (week)
            fixtures.push({ goalId: g.id, date: g.date, name: g.name, distanceM: g.distanceM, weekIndex: week.index });
    }
    return fixtures.sort((a, b) => a.date.localeCompare(b.date));
}

/** The fixtures falling between two dates, for one week's prompt. */
export function fixturesBetween(goals: FixtureGoal[], boundGoalId: string, from: string, to: string) {
    return tuneUpFixtures({
        goals,
        boundGoalId,
        startDate: from,
        endDate: to,
        weeks: [{ index: 0, startDate: from, endDate: to }],
    }).map(({ date, name, distanceM }) => ({ date, name, distanceM }));
}

/** A stored goal as a fixture candidate. */
export const toFixtureGoal = (g: {
    id: string;
    targetEventDate: Date | null;
    targetEventName: string | null;
    targetDistanceM: number | null;
}): FixtureGoal => ({
    id: g.id,
    date: g.targetEventDate ? g.targetEventDate.toISOString().slice(0, 10) : null,
    name: g.targetEventName,
    distanceM: g.targetDistanceM,
});
