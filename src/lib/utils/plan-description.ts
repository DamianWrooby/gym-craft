// The PDF export of one plan week, built from the typed session body (ADR 0007). Shares its step
// wording with the week calendar through session-format, so the page and the PDF never disagree.
import { m } from '$lib/paraglide/messages.js';
import { getLocale } from '$lib/paraglide/runtime.js';
import { otherEffortLabel } from '$lib/i18n/labels';
import { stepLines } from '$lib/planner/session-format';
import { formatVolume, type PlanView, type PlanViewSession } from '$lib/planner/plan-view';

function escapeHtml(str: string | number | null | undefined): string {
    if (str == null) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

const KIND_LABEL: Record<PlanViewSession['kind'], () => string> = {
    RUNNING: m.form_kind_run,
    STRENGTH: m.form_kind_strength,
    OTHER: m.form_kind_other,
};

function sessionHtml(s: PlanViewSession, schoolId: string | null): string {
    let html = `<h3>${KIND_LABEL[s.kind]()}: ${escapeHtml(s.body.title)}</h3>`;
    if ('steps' in s.body) {
        if (s.body.reason)
            html += `<p style="color:#555;">${escapeHtml(m.pdf_key_session({ reason: s.body.reason }))}</p>`;
        if (s.staleAnchor) html += `<p style="color:#a15c00;">${escapeHtml(m.session_stale_anchor())}</p>`;
        html += '<ul>';
        for (const line of stepLines(s.body.steps, schoolId)) {
            const note = line.note ? ` <em>(${escapeHtml(line.note)})</em>` : '';
            html += `<li style="margin-left:${line.nested ? 1.5 : 0}em;">${escapeHtml(line.text)}${note}</li>`;
        }
        html += '</ul>';
    } else if ('exercises' in s.body) {
        html += `<p>${s.body.durationMin} min</p><ul>`;
        for (const e of s.body.exercises) {
            const load = e.load ? ` @ ${escapeHtml(e.load)}` : '';
            html += `<li>${escapeHtml(e.name)}: ${e.sets} × ${escapeHtml(e.reps)}${load}</li>`;
        }
        html += '</ul>';
    } else {
        html += `<p>${s.body.durationMin} min, ${escapeHtml(otherEffortLabel(s.body.effort))}</p>`;
    }
    return html;
}

export function weekToHtml(plan: PlanView, index: number): string {
    const week = plan.weeks[index];
    const phase = plan.phases.find((p) => p.ordinal === week.phaseOrdinal);
    let html = `<h1>${escapeHtml(plan.goalName)}: ${escapeHtml(m.timeline_week({ n: index + 1 }))}</h1>`;
    html += `<p>${escapeHtml(plan.school.name)} · ${escapeHtml(phase?.name)} · ${week.startDate} – ${week.endDate}</p>`;
    html += `<p>${escapeHtml(m.pdf_targets({ volume: formatVolume(week.volumeTarget, week.volumeUnit), strength: week.strengthSessionTarget }))}</p>`;

    const days = [...new Set(week.sessions.map((s) => s.scheduledDate))];
    if (days.length === 0) html += `<p>${escapeHtml(m.pdf_no_sessions())}</p>`;
    for (const day of days) {
        const weekday = new Date(`${day}T00:00:00Z`).toLocaleDateString(getLocale(), {
            weekday: 'long',
            timeZone: 'UTC',
        });
        html += `<h2>${weekday} ${day}</h2>`;
        for (const s of week.sessions.filter((x) => x.scheduledDate === day)) html += sessionHtml(s, plan.school.id);
    }
    return html;
}

// html2pdf.js is untyped and browser-only, so it is imported lazily at click time.
export async function downloadWeekPdf(plan: PlanView, index: number): Promise<void> {
    // @ts-expect-error html2pdf.js is not typed
    const { default: html2pdf } = await import('html2pdf.js');

    const container = document.createElement('div');
    container.innerHTML = `<div style="font-family: Helvetica, Arial, sans-serif; font-size: 11pt; line-height: 1.5;">${weekToHtml(plan, index)}</div>`;
    container.style.color = 'black';

    html2pdf()
        .set({
            margin: [20, 20],
            filename: `plan-week-${index + 1}-${plan.weeks[index].startDate}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2 },
            jsPDF: { unit: 'pt', format: 'a4', orientation: 'portrait' },
            pagebreak: { mode: ['avoid-all', 'css', 'legacy'] },
        })
        .from(container)
        .save();
}
