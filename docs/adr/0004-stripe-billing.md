# ADR 0004 — Stripe hosted checkout with webhook-driven tier state

**Status:** Accepted (2026-07-01)

## Context

Billing needs to be hobby-maintainable: no card forms, no PCI surface, minimal subscription
lifecycle code. The app runs on Netlify behind session auth; Stripe webhooks arrive
unauthenticated.

## Decision

- **Stripe hosted Checkout** for purchase (three prices: monthly, annual, one-time lifetime) and
  the **hosted Customer Portal** for cancel/manage. The app never touches card data.
- Endpoints under `src/routes/api/stripe/`:
  - `checkout` — creates the session (`mode: 'payment'` for lifetime, `'subscription'` otherwise),
    lazily creates the Stripe customer, stores `stripeCustomerId`.
  - `webhook` — signature-verified via `SECRET_STRIPE_WEBHOOK_SECRET`, **whitelisted in
    `hooks.server.ts`** (no session cookie; the signature is the auth). Handles
    `checkout.session.completed`, `customer.subscription.updated/deleted`.
  - `portal` — returns a portal link.
- **Webhook writes are the source of truth for stored fields** (`subscriptionStatus`,
  `currentPeriodEnd`, ids); **request-time `resolveTier` is the access gate** (ADR 0002). A
  one-time payment sets the `lifetimeSupporter` boolean, which overrides everything.
- Post-checkout UX: Stripe redirects to `/app/my-account?checkout=success|cancel`; the page
  shows a toast and schedules a delayed `invalidateAll()` because the webhook can lag the
  redirect by a few seconds.

## Consequences

- No dunning/lifecycle code; Stripe handles retries, invoices, and SCA.
- Stripe SDK v22 pins `apiVersion: '2026-06-24.dahlia'`; in this API version
  `current_period_end` lives on `subscription.items.data[0]`, not the subscription object.
- Env vars (`SECRET_STRIPE_KEY`, `SECRET_STRIPE_WEBHOOK_SECRET`, three `STRIPE_PRICE_*` ids) are
  build-time (`$env/static/private`) — changing them requires a redeploy. Operational setup is
  documented in `docs/stripe-account-setup.md`.
- Open before live: EU VAT approach (Stripe Tax needs `automatic_tax: { enabled: true }` added
  to the checkout session), portal cancel-vs-switch config, refund policy copy.
