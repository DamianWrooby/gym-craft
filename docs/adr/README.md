# Architecture Decision Records

Short records of the decisions that shaped GymCraft's business model and subscription system.
Format: lightweight MADR (Context → Decision → Consequences). One decision per file, numbered,
never rewritten — superseded decisions get a new ADR that links back.

| #    | Decision                                                                     | Status   |
| ---- | ---------------------------------------------------------------------------- | -------- |
| 0001 | [Sustainable-hobby business model with a two-tier subscription](0001-business-model.md) | Accepted |
| 0002 | [Tier enforcement via TIER_LIMITS and per-request resolveTier](0002-tier-enforcement.md) | Accepted |
| 0003 | [Usage metering through the AiUsage table](0003-usage-metering.md)           | Accepted |
| 0004 | [Stripe hosted checkout with webhook-driven tier state](0004-stripe-billing.md) | Accepted |
| 0005 | [Tier-based AI model selection via the proxy `model` field](0005-tier-based-ai-model.md) | Accepted |
| 0006 | [Premium feature scoping: backfill window and report export](0006-premium-feature-scoping.md) | Accepted |

Related documents:

- Full product/marketing spec: `docs/superpowers/specs/2026-06-30-marketing-business-model-design.md`
- Implementation plans: `docs/superpowers/plans/2026-07-01-subscription-phase-1.md`, `docs/superpowers/plans/2026-07-06-subscription-phase-2.md`
- Stripe operational runbook (account setup, webhooks, tax, go-live): `docs/stripe-account-setup.md`
