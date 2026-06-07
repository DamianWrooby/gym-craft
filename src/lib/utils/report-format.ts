export function formatReportPeriod(start: string, end: string): string {
    const fmt = (s: string) =>
        new Date(`${s}T00:00:00Z`).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            timeZone: 'UTC',
        });
    return `${fmt(start)} – ${fmt(end)}`;
}

export function reportSummaryPreview(text: string, max = 140): string {
    const stripped = text.replace(/[#*_`>-]/g, '').trim();
    return stripped.length > max ? `${stripped.slice(0, max)}…` : stripped;
}
