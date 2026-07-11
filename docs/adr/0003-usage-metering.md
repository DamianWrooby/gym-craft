# ADR 0003 — Usage metering through the AiUsage table

**Status:** Accepted (2026-07-01, extends the pre-subscription rate-limit design)

## Context

Before subscriptions, the app already rate-limited AI features via
`AiUsage(userId, kind, day, count)`: daily keys for "Explain my run" (`kind='explain_run'`,
`day=YYYY-MM-DD`) and monthly keys for weekly reports (`kind='weekly_report'`,
`day=first-of-month`). Gym plans used a separate lifetime counter
(`Configuration.generalPlanLimit − User.generatedPlansNumber`). The subscription needed
per-tier caps without inventing a second metering mechanism.

## Decision

- Keep `AiUsage` as the metering primitive; the cap **value** comes from `TIER_LIMITS`
  (ADR 0002), the **count** from `AiUsage`.
- The "monthly reset" stays a read-time concept — the row key encodes the month; no reset job.
- Gym plans split by tier: **FREE keeps the lifetime cap** (unchanged legacy path);
  **SUPPORTER gets 5/month** via `kind='gym_plan'`, `day=first-of-month`.
- `User.generatedPlansNumber` still increments for supporters — it remains the lifetime stat and
  the number a canceled supporter falls back to. A heavy ex-supporter may therefore see 0 free
  plans left; intended.
- Cap checks are **pre-flight reads + non-locking upserts**. Two concurrent requests can
  overshoot by one; with small caps on slow LLM operations the race window is accepted. Do not
  reintroduce locking unless the product changes.

## Consequences

- One table answers "how much has this user used" for every AI feature.
- Timezone semantics are UTC day/month keys — users near midnight may see resets a few hours
  off; consistent with the pre-existing behavior and not worth complicating.
- If a third monthly kind appears, extract the inlined kind strings into a constant (deferred
  as YAGNI at two).
