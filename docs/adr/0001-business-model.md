# ADR 0001 — Sustainable-hobby business model with a two-tier subscription

**Status:** Accepted (2026-06-30) · **Implemented:** July 2026 (`feat/subscription`)

## Context

GymCraft is a solo side project with real recurring costs (OpenAI API, Garmin microservice
hosting, database, Netlify). The owner's ambition is explicitly a **sustainable hobby** — keep the
app alive for himself and a small community — not a growth business. Options considered:
bring-your-own-API-key, donations/tip jar, hard free caps with no monetization, and a cheap
optional subscription.

## Decision

A **cheap optional subscription** with two tiers:

- **FREE** — genuinely useful forever: 2 weekly reports/month, 1 run explanation/day,
  10 AI gym plans (lifetime), 60-day Garmin backfill.
- **SUPPORTER** — €4/month or €36/year, plus a €25 one-time "Founding Supporter" (lifetime)
  launch promo: 15 reports/month, 5 explanations/day, 5 gym plans/month, 120-day backfill,
  smarter AI model, report export (MD/PDF), supporter badge.

Success metric: **cost-recovery ratio ≥ 1.0** (monthly supporter revenue ÷ monthly running
costs). Explicit anti-goals: MRR growth rate, CAC, aggressive funnel optimization — if chasing
them feels like a job, stop.

## Consequences

- Recurring revenue matches the recurring OpenAI cost profile; ~10–20 supporters cover costs.
- Requires Stripe billing code and a tier-gating layer (ADRs 0002–0004).
- The free tier doubles as the marketing funnel; upgrade prompts appear contextually at
  cap-reached moments rather than as nags.
- Lifetime supporters keep monthly usage caps as the cost safeguard (a lifetime purchase must
  not become an unbounded API liability).
