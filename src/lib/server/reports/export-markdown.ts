interface ExportGoal {
    goalType: string;
    targetEventName: string | null;
    priority: number;
}

export interface ExportableReport {
    periodStart: string;
    periodEnd: string;
    summary: string;
    createdAt: Date;
    goalContext: {
        notes: string | null;
        goals: ExportGoal[];
    };
}

export function buildReportMarkdown(report: ExportableReport): string {
    const lines: string[] = [
        `# Weekly Training Report — ${report.periodStart} to ${report.periodEnd}`,
        '',
        `_Generated ${report.createdAt.toISOString().slice(0, 10)} by GymCraft._`,
        '',
    ];

    if (report.goalContext.goals.length > 0) {
        lines.push('## Goals', '');
        for (const goal of report.goalContext.goals) {
            const name = goal.targetEventName ? ` — ${goal.targetEventName}` : '';
            lines.push(`- ${goal.goalType}${name} (priority ${goal.priority})`);
        }
        lines.push('');
    }

    if (report.goalContext.notes) {
        lines.push('## Notes', '', report.goalContext.notes, '');
    }

    lines.push(report.summary, '');
    return lines.join('\n');
}
