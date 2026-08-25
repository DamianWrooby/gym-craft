import { addDays, mondayOf, toIsoDate } from '$lib/utils/iso-week';
import { isWalkingTypeKey } from '$lib/utils/activity-type';

/**
 * A single Monday–Sunday cell on the load timeline (CONTEXT.md "Load timeline").
 * - `report`: the week has a weekly report — render a load bar coloured by status.
 * - `gap`:    the athlete trained but generated no report (CONTEXT.md "Report gap")
 *             — render a fillable empty slot.
 * - `empty`:  no training that week — nothing to report, render blank.
 */
/** Rolling window length of the load timeline, in weeks (ADR/CONTEXT: "Load timeline"). */
export const TIMELINE_WEEKS = 12;

export type WeekCellState = 'report' | 'gap' | 'empty';

export interface WeekCell {
    periodStart: string;
    periodEnd: string;
    state: WeekCellState;
    reportId: string | null;
    acwrStatus: string | null;
    weeklyTotalLoad: number | null;
    monotonyIsHigh: boolean | null;
}

export interface TimelineReport {
    id: string;
    periodStart: string;
    acwrStatus: string | null;
    weeklyTotalLoad: number | null;
    monotonyIsHigh: boolean | null;
}

export interface TimelineActivity {
    startTime: string | Date;
    activityType: string;
}

/** The `count` most recent Monday–Sunday weeks, newest first, ending in the week of `asOf`. */
export function enumerateWeeks(asOf: string, count: number): Array<{ periodStart: string; periodEnd: string }> {
    const currentMonday = mondayOf(asOf);
    const weeks: Array<{ periodStart: string; periodEnd: string }> = [];
    for (let i = 0; i < count; i++) {
        const periodStart = addDays(currentMonday, -7 * i);
        weeks.push({ periodStart, periodEnd: addDays(periodStart, 6) });
    }
    return weeks;
}

/** Monday-of-week ISO strings for every week that contains at least one training activity. */
export function trainingWeekStarts(activities: TimelineActivity[]): Set<string> {
    const starts = new Set<string>();
    for (const activity of activities) {
        if (isWalkingTypeKey(activity.activityType)) continue;
        const iso =
            typeof activity.startTime === 'string' ? activity.startTime.slice(0, 10) : toIsoDate(activity.startTime);
        starts.add(mondayOf(iso));
    }
    return starts;
}

export function buildWeekTimeline(params: {
    asOf: string;
    count: number;
    reports: TimelineReport[];
    activities: TimelineActivity[];
}): WeekCell[] {
    const byStart = new Map(params.reports.map((report) => [report.periodStart, report]));
    const trained = trainingWeekStarts(params.activities);

    return enumerateWeeks(params.asOf, params.count).map(({ periodStart, periodEnd }) => {
        const report = byStart.get(periodStart);
        if (report) {
            return {
                periodStart,
                periodEnd,
                state: 'report',
                reportId: report.id,
                acwrStatus: report.acwrStatus,
                weeklyTotalLoad: report.weeklyTotalLoad,
                monotonyIsHigh: report.monotonyIsHigh,
            };
        }
        return {
            periodStart,
            periodEnd,
            state: trained.has(periodStart) ? 'gap' : 'empty',
            reportId: null,
            acwrStatus: null,
            weeklyTotalLoad: null,
            monotonyIsHigh: null,
        };
    });
}
