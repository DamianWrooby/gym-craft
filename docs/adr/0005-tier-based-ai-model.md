# ADR 0005 — Tier-based AI model selection via the proxy `model` field

**Status:** Accepted (2026-07-06)

## Context

The Supporter tier promises a smarter AI model. All long-running OpenAI calls go through the
external `gym-craft-ai-proxy` (Express), which historically chose its own model. Three AI paths
exist: weekly reports and explain-run (server-built prompts → proxy) and gym-plan generation
(browser-built request → proxy directly).

## Decision

- `TIER_LIMITS[tier].aiModel` maps FREE → `gpt-5.4-mini`, SUPPORTER → `gpt-5.4`.
- The server-side proxy callers (`src/lib/server/reports/call-proxy.ts`) send an optional
  `model` field in the request body for **weekly reports and explain-run**.
- The proxy validates the value against an **allowlist** (`app/config/openAI.config.js`,
  branch `feat/tier-model-override` in `gym-craft-ai-proxy`) and silently falls back to its
  default for unknown ids. Wire contract documented in `.ai/WEEKLY_REPORT_PROXY_SPEC.md` and
  `.ai/EXPLAIN_RUN_PROXY_SPEC.md`.
- **Gym-plan generation is deliberately excluded**: its request is built in the browser, so any
  client-chosen model would be trivially spoofable by a free user. It keeps the proxy default.

## Consequences

- The model swap is a config change on both sides; no prompt changes.
- Backward/forward compatible: an un-updated proxy ignores the extra field; an updated proxy
  falls back safely on unknown ids.
- Deployment coupling: until the proxy branch is deployed, supporters silently get the default
  model. Verify the `gpt-5.4*` ids are valid on the OpenAI account before deploying — an invalid
  id yields 502s from OpenAI, not a fallback.
