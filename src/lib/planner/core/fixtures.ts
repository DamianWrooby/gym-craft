// Tune-up fixtures (ADR 0008): other dated goals inside the horizon become fixed hard days.
// Slice 1 derives them on read; a later slice stores them as athlete-owned planned sessions.

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
