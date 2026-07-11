# ADR 0002 — Tier enforcement via TIER_LIMITS and per-request resolveTier

**Status:** Accepted (2026-07-01)

## Context

Tier gating touches server endpoints (cap checks), client pages (counters, copy, sync windows),
and future premium features. Scattering per-feature constants would drift; putting the map under
`$lib/server` would break the client build, because SvelteKit's server-only guard rejects
`.svelte` imports of server modules.

## Decision

- **`src/constants/subscription.constants.ts`** holds the `SubscriptionTier` type, the
  `TierLimits` interface, the `TIER_LIMITS` map, and `getLimit()`. It is the **single source of
  truth** for every cap, window, and model choice, and lives in `constants/` (not `$lib/server`)
  precisely so both server endpoints and client components can import it.
- **`src/lib/server/subscription/tier.ts`** holds the pure `resolveTier()` function (server-only):
  SUPPORTER when `lifetimeSupporter`, or when `subscriptionStatus === 'active'` and
  `currentPeriodEnd > now`; otherwise FREE.
- The tier is resolved **once per request** inside `updateUser()` (`src/lib/utils/user.ts`) and
  exposed as `locals.user.subscriptionTier`, so endpoints read it with zero extra queries.
- `gymPlansPerMonth: null` is the FREE sentinel meaning "legacy lifetime cap applies" — do not
  coerce it with `?? 0`.

## Consequences

- Request-time resolution is the access gate: an expired subscription downgrades immediately,
  even before Stripe's `customer.subscription.deleted` webhook arrives.
- Changing a cap is a one-line edit with tests asserting the agreed numbers.
- `TIER_LIMITS` ships in the client bundle; it contains no secrets. Do not move it under
  `$lib/server` — that breaks the build.
