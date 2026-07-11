# ADR 0006 — Premium feature scoping: backfill window and report export

**Status:** Accepted (2026-07-06, PDF export added 2026-07-08)

## Context

Two premium features needed sizing judgment rather than just gating: how much Garmin history a
backfill fetches, and what "report export" means concretely.

## Decision

**Garmin backfill: FREE 60 days / SUPPORTER 120 days — not 365.** The backfill is the slowest
operation in the app (it runs browser-side through the proxy specifically to dodge Netlify's
function timeout, and must wake the spun-down free-tier Garmin microservice). 365 days would
materially raise load and failure risk; 120 still feels premium. The window is a **parameter**
threaded from `TIER_LIMITS` through `resolveSyncWindow` / `syncUserActivities` /
`runProxySync` — the old `BACKFILL_DAYS = 90` constant is gone. Shrinking FREE to 60 affects
only future backfills; existing rows are never deleted.

**Report export: Markdown server-side + PDF client-side.**

- Markdown: a supporter-gated endpoint
  (`/api/user/[id]/reports/weekly/[reportId]/export`) built on the pure `buildReportMarkdown()`.
  **Server-enforced** (403 `UPGRADE_REQUIRED` for FREE).
- PDF: generated **client-side** with the `html2pdf.js` pattern that already existed for
  gym-plan export (`src/lib/utils/report-pdf.ts`; markdown summary rendered via `marked` +
  `DOMPurify` with the same allowlist as `Markdown.svelte`). The PDF gate is **UI-only** — the
  data is already on the page, so this is a product nudge, not a security boundary.
- PDFs contain the report text (period, goals, notes, coach review), **not the charts** —
  html2canvas chart capture is flaky (dark theme, canvas scaling) and the gym-plan precedent is
  clean generated HTML rather than DOM screenshots.

## Consequences

- Backfill cost/risk stays bounded; raising the supporter window later is a one-line change.
- Export needed no new dependencies. Chart-inclusive PDFs remain a possible (riskier) later
  iteration.
- Anyone auditing entitlement enforcement should know: MD export is hard-gated, PDF is soft.
