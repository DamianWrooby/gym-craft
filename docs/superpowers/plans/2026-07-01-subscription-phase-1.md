# Subscription — Phase 1 (Money Path) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a working two-tier (`FREE` / `SUPPORTER`) subscription for GymCraft — Stripe checkout/webhook/portal, a tier-aware usage-limit system, and a billing UI — so the app can recover its running costs.

**Architecture:** Add subscription fields to the `User` table. A single `TIER_LIMITS` map plus a pure `resolveTier()` function become the source of truth for "what tier is this user and what may they do." The user's tier is resolved once per request inside the existing `updateUser()` hook and exposed on `locals.user.subscriptionTier`, so cap-check endpoints read it with zero extra queries. Stripe drives tier changes through a signature-verified webhook that writes the subscription fields. Lifetime supporters (a launch promo, one-time payment) are a boolean override.

**Tech Stack:** SvelteKit (Svelte 4), Prisma + PostgreSQL, Stripe Node SDK, Vitest, TypeScript.

**Scope note — what is NOT in Phase 1:** Gym-plan monthly tiering for supporters, the smarter-model swap, 120-day Garmin backfill, report export, and the supporter badge are **Phase 2** (premium features). They get their own plan. Phase 1 changes the FREE caps for weekly reports (4→2) and explain-run (10→1), adds the SUPPORTER caps (15 / 5), and builds the entire billing path. This plan is independently shippable.

**Source spec:** `docs/superpowers/specs/2026-06-30-marketing-business-model-design.md`

---

## File Structure

**Create:**

- `src/constants/subscription.constants.ts` — `SubscriptionTier` type + `TierLimits` interface + `TIER_LIMITS` map + `getLimit()` helper. Single source of truth for caps. Lives in `constants/` (not `$lib/server`) because both server endpoints **and** client `.svelte` components import it — SvelteKit's server-only guard would fail the build if a `.svelte` file imported a `$lib/server` value.
- `src/constants/subscription.constants.test.ts` — tests for the map/helper.
- `src/lib/server/subscription/tier.ts` — pure `resolveTier()` function (server-only; used by `updateUser`).
- `src/lib/server/subscription/tier.test.ts` — tests for tier resolution.
- `src/lib/server/stripe.ts` — configured Stripe SDK client (server-only).
- `src/routes/api/stripe/checkout/+server.ts` — creates a Checkout Session.
- `src/routes/api/stripe/checkout/server.test.ts` — checkout endpoint tests.
- `src/routes/api/stripe/webhook/+server.ts` — verifies + handles Stripe webhooks.
- `src/routes/api/stripe/webhook/server.test.ts` — webhook endpoint tests.
- `src/routes/api/stripe/portal/+server.ts` — creates a Customer Portal session.
- `src/lib/components/billing/BillingPanel.svelte` — tier display + upgrade/manage buttons.
- `prisma/migrations/<timestamp>_add_subscription_fields/migration.sql` — auto-generated.

**Modify:**

- `prisma/schema.prisma` — add `SubscriptionTier` enum + 5 fields to `User`.
- `src/models/user/user.model.ts` — add `subscriptionTier` to the `User` interface.
- `src/lib/utils/user.ts` — select new fields, compute `subscriptionTier` via `resolveTier`, put it on `locals.user`.
- `src/constants/training-report.constants.ts` — remove the two flat limit constants (moved into `TIER_LIMITS`).
- `src/routes/api/user/[id]/reports/weekly/+server.ts` — read the cap from `TIER_LIMITS`.
- `src/routes/api/user/[id]/reports/weekly/server.test.ts` — adjust limit references.
- `src/routes/api/user/[id]/activities/[activityId]/explain/+server.ts` — read the cap from `TIER_LIMITS`.
- `src/routes/app/running/reports/+page.svelte` — replace the constant reference.
- `src/hooks.server.ts` — whitelist `/api/stripe/webhook` (no session/cookie).
- `src/routes/app/my-account/+page.svelte` — render `<BillingPanel>`.
- `.env.example` (create if absent) — document the new env vars.

---

## Task 1: Install Stripe and document env vars

**Files:**

- Modify: `package.json` (via npm)
- Create/Modify: `.env.example`

- [ ] **Step 1: Install the Stripe SDK**

Run: `npm install stripe`
Expected: `stripe` added to `dependencies` in `package.json`, `package-lock.json` updated.

- [ ] **Step 2: Document the new environment variables**

Append to `.env.example` (create the file if it does not exist):

```bash
# Stripe (subscription billing)
SECRET_STRIPE_KEY=sk_test_xxx
SECRET_STRIPE_WEBHOOK_SECRET=whsec_xxx
STRIPE_PRICE_MONTHLY=price_xxx
STRIPE_PRICE_ANNUAL=price_xxx
STRIPE_PRICE_LIFETIME=price_xxx
```

Then add these same five keys with placeholder values to your local `.env` so the dev server boots (SvelteKit's `$env/static/private` fails the build if a referenced var is missing).

- [ ] **Step 3: Commit**

```powershell
git add package.json package-lock.json .env.example
git commit -m "chore(billing): add stripe dependency and env var docs"
```

---

## Task 2: Add subscription fields to the database

**Files:**

- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_add_subscription_fields/migration.sql` (auto-generated)

- [ ] **Step 1: Add the enum**

In `prisma/schema.prisma`, add this enum next to the other enums (e.g. after the `Role` enum, around line 60):

```prisma
enum SubscriptionTier {
    FREE
    SUPPORTER
}
```

- [ ] **Step 2: Add fields to the `User` model**

In `model User`, add these fields after `generatedPlansNumber` (line 23):

```prisma
    subscriptionTier     SubscriptionTier    @default(FREE)
    stripeCustomerId     String?             @unique
    stripeSubscriptionId String?
    subscriptionStatus   String?
    currentPeriodEnd     DateTime?
    lifetimeSupporter    Boolean             @default(false)
```

- [ ] **Step 3: Stop the dev server / IDE TS server**

On Windows the dev server can hold a lock on `query_engine-windows.dll.node` (per CLAUDE.md). If `npm run dev` is running, stop it before the next step.

- [ ] **Step 4: Generate and apply the migration**

Run: `npx prisma migrate dev --name add_subscription_fields`
Expected: a new `prisma/migrations/<timestamp>_add_subscription_fields/migration.sql` containing `ALTER TABLE "User" ADD COLUMN ...` for each field plus `CREATE TYPE "SubscriptionTier"`. Prisma applies it and regenerates the client.

- [ ] **Step 5: Sanity-check the migration**

Open the generated `migration.sql` and confirm it only adds the enum + the six columns. No unrelated diffs.

- [ ] **Step 6: Commit**

```powershell
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(billing): add subscription fields to User"
```

---

## Task 3: Tier-limits source of truth

**Files:**

- Create: `src/constants/subscription.constants.ts`
- Test: `src/constants/subscription.constants.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/constants/subscription.constants.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { TIER_LIMITS, getLimit } from './subscription.constants';

describe('TIER_LIMITS', () => {
    it('encodes the agreed FREE caps', () => {
        expect(TIER_LIMITS.FREE.weeklyReportsPerMonth).toBe(2);
        expect(TIER_LIMITS.FREE.explainRunsPerDay).toBe(1);
    });

    it('encodes the agreed SUPPORTER caps', () => {
        expect(TIER_LIMITS.SUPPORTER.weeklyReportsPerMonth).toBe(15);
        expect(TIER_LIMITS.SUPPORTER.explainRunsPerDay).toBe(5);
    });
});

describe('getLimit', () => {
    it('returns the cap for a tier + kind', () => {
        expect(getLimit('FREE', 'weeklyReportsPerMonth')).toBe(2);
        expect(getLimit('SUPPORTER', 'explainRunsPerDay')).toBe(5);
    });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/constants/subscription.constants.test.ts`
Expected: FAIL — `Cannot find module './subscription.constants'`.

- [ ] **Step 3: Implement the module**

Create `src/constants/subscription.constants.ts`:

```ts
export type SubscriptionTier = 'FREE' | 'SUPPORTER';

// Phase 1 caps only. Phase 2 will extend TierLimits with gymPlansPerMonth,
// garminBackfillDays, model, and reportExport. Keep this the single source of truth.
export interface TierLimits {
    weeklyReportsPerMonth: number;
    explainRunsPerDay: number;
}

export const TIER_LIMITS: Record<SubscriptionTier, TierLimits> = {
    FREE: {
        weeklyReportsPerMonth: 2,
        explainRunsPerDay: 1,
    },
    SUPPORTER: {
        weeklyReportsPerMonth: 15,
        explainRunsPerDay: 5,
    },
};

export function getLimit<K extends keyof TierLimits>(tier: SubscriptionTier, kind: K): TierLimits[K] {
    return TIER_LIMITS[tier][kind];
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/constants/subscription.constants.test.ts`
Expected: PASS — all cases.

- [ ] **Step 5: Commit**

```powershell
git add src/constants/subscription.constants.ts src/constants/subscription.constants.test.ts
git commit -m "feat(billing): add tier-limits source of truth"
```

---

## Task 4: Pure `resolveTier` function

**Files:**

- Create: `src/lib/server/subscription/tier.ts`
- Test: `src/lib/server/subscription/tier.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/server/subscription/tier.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { resolveTier } from './tier';

const future = new Date(Date.now() + 86_400_000);
const past = new Date(Date.now() - 86_400_000);

describe('resolveTier', () => {
    it('returns FREE for a brand-new user', () => {
        expect(resolveTier({ lifetimeSupporter: false, subscriptionStatus: null, currentPeriodEnd: null })).toBe('FREE');
    });

    it('returns SUPPORTER for a lifetime supporter regardless of period', () => {
        expect(resolveTier({ lifetimeSupporter: true, subscriptionStatus: null, currentPeriodEnd: past })).toBe(
            'SUPPORTER',
        );
    });

    it('returns SUPPORTER for an active subscription that has not expired', () => {
        expect(
            resolveTier({ lifetimeSupporter: false, subscriptionStatus: 'active', currentPeriodEnd: future }),
        ).toBe('SUPPORTER');
    });

    it('returns FREE for an active subscription whose period has ended', () => {
        expect(resolveTier({ lifetimeSupporter: false, subscriptionStatus: 'active', currentPeriodEnd: past })).toBe(
            'FREE',
        );
    });

    it('returns FREE for a canceled subscription', () => {
        expect(
            resolveTier({ lifetimeSupporter: false, subscriptionStatus: 'canceled', currentPeriodEnd: future }),
        ).toBe('FREE');
    });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/server/subscription/tier.test.ts`
Expected: FAIL — `Cannot find module './tier'`.

- [ ] **Step 3: Implement the function**

Create `src/lib/server/subscription/tier.ts`:

```ts
import type { SubscriptionTier } from '@/constants/subscription.constants';

export interface TierInputs {
    lifetimeSupporter: boolean;
    subscriptionStatus: string | null;
    currentPeriodEnd: Date | null;
}

export function resolveTier(u: TierInputs, now: Date = new Date()): SubscriptionTier {
    if (u.lifetimeSupporter) return 'SUPPORTER';
    if (u.subscriptionStatus === 'active' && u.currentPeriodEnd && u.currentPeriodEnd > now) {
        return 'SUPPORTER';
    }
    return 'FREE';
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/server/subscription/tier.test.ts`
Expected: PASS — all 5 cases.

- [ ] **Step 5: Commit**

```powershell
git add src/lib/server/subscription/tier.ts src/lib/server/subscription/tier.test.ts
git commit -m "feat(billing): add pure resolveTier function"
```

---

## Task 5: Expose `subscriptionTier` on `locals.user`

**Files:**

- Modify: `src/models/user/user.model.ts`
- Modify: `src/lib/utils/user.ts`

- [ ] **Step 1: Extend the `User` interface**

In `src/models/user/user.model.ts`, add the field (and import the type):

```ts
import type { SubscriptionTier } from '@/constants/subscription.constants';

export interface User {
    id: string;
    name: string;
    email: string;
    emailVerified: boolean;
    marketingAgreement: boolean;
    role: string;
    generatedPlansNumber: number;
    plansLeft: number;
    subscriptionTier: SubscriptionTier;
}
```

- [ ] **Step 2: Resolve the tier inside `updateUser`**

In `src/lib/utils/user.ts`:

1. Add the import at the top:

```ts
import { resolveTier } from '$lib/server/subscription/tier';
```

2. Add the three new fields to the `select` block (after `email: true`):

```ts
            email: true,
            subscriptionStatus: true,
            currentPeriodEnd: true,
            lifetimeSupporter: true,
```

3. Inside `if (user)`, compute the tier and add it to `event.locals.user`. Replace the destructuring + assignment block (lines 37-49) with:

```ts
        const { id, username, role, generatedPlansNumber, emailVerified, marketingAgreement, email } = user;
        const subscriptionTier = resolveTier({
            lifetimeSupporter: user.lifetimeSupporter,
            subscriptionStatus: user.subscriptionStatus,
            currentPeriodEnd: user.currentPeriodEnd,
        });
        if (event.locals) {
            event.locals.user = {
                id,
                name: username,
                role: role.name,
                generatedPlansNumber,
                plansLeft,
                emailVerified,
                marketingAgreement,
                email,
                subscriptionTier,
            };
        }
```

- [ ] **Step 3: Type-check**

Run: `npm run check`
Expected: PASS for these two files. (Any endpoint that constructs a `User` object literal in a test may now error about the missing `subscriptionTier` field — note them; they're fixed in their own tasks below. If `npm run check` flags unrelated test fixtures, add `subscriptionTier: 'FREE'` to those literals.)

- [ ] **Step 4: Commit**

```powershell
git add src/models/user/user.model.ts src/lib/utils/user.ts
git commit -m "feat(billing): resolve subscriptionTier onto locals.user"
```

---

## Task 6: Make the weekly-report cap tier-aware

**Files:**

- Modify: `src/routes/api/user/[id]/reports/weekly/+server.ts`
- Modify: `src/constants/training-report.constants.ts`
- Modify: `src/routes/app/running/reports/+page.svelte`
- Test: `src/routes/api/user/[id]/reports/weekly/server.test.ts`

- [ ] **Step 1: Update the endpoint to read the tier cap**

In `src/routes/api/user/[id]/reports/weekly/+server.ts`:

1. Replace the constant import (line 19):

```ts
import { getLimit } from '@/constants/subscription.constants';
```

2. Replace the cap check (lines 63-68) with a tier lookup. Change it to:

```ts
    const reportLimit = getLimit(locals.user.subscriptionTier, 'weeklyReportsPerMonth');
    if (count >= reportLimit) {
        return createResponse(403, {
            code: 'REPORT_LIMIT_REACHED',
            message: 'Monthly report generation limit reached',
        });
    }
```

(`locals.user` is guaranteed non-null here because the handler already returned 403 at line 36-38 if `userId !== locals.user?.id`.)

- [ ] **Step 2: Remove the obsolete constant**

In `src/constants/training-report.constants.ts`, delete lines 3-8 (the `WEEKLY_REPORT_MONTHLY_LIMIT` comment block + constant). Leave `EXPLAIN_RUN_DAILY_LIMIT` for now — Task 7 removes it.

- [ ] **Step 3: Fix the reports page reference**

In `src/routes/app/running/reports/+page.svelte`, the UI shows the monthly cap. Replace the `WEEKLY_REPORT_MONTHLY_LIMIT` import and usages with the tier-aware value from page data. At the top script:

```ts
import { TIER_LIMITS } from '@/constants/subscription.constants';
```

Then where the limit was referenced, derive it from the user's tier (the page already has `$page.data.user`):

```ts
$: reportLimit = TIER_LIMITS[$page.data.user.subscriptionTier].weeklyReportsPerMonth;
```

Replace each textual use of `WEEKLY_REPORT_MONTHLY_LIMIT` with `reportLimit`. (Search the file for `WEEKLY_REPORT_MONTHLY_LIMIT`; there is the counter label `{monthlyReportCount}/{...}` and the limit-reached toasts.)

> `TIER_LIMITS` lives in `src/constants/` precisely so this client component can import it without tripping SvelteKit's `$lib/server` guard. No server-only code is pulled into the client bundle.

- [ ] **Step 4: Update the endpoint test**

In `src/routes/api/user/[id]/reports/weekly/server.test.ts`:

1. The handler now reads `locals.user.subscriptionTier`. Ensure the `locals` fixture's user includes it. Find where `locals` is built (the user object) and add `subscriptionTier: 'FREE'`.

2. The pre-flight 403 test previously used a cap of 4. FREE is now 2. Update the test that drives the limit so the mocked `getMonthlyWeeklyReportCount` returns a value `>= 2` (e.g. `mockResolvedValueOnce(2)`), and keep asserting `response.status === 403`.

3. If any test asserts the literal old limit number, change `4` → `2`.

- [ ] **Step 5: Run the test**

Run: `npx vitest run src/routes/api/user/[id]/reports/weekly/server.test.ts`
Expected: PASS.

- [ ] **Step 6: Type-check**

Run: `npm run check`
Expected: PASS (the explain endpoint still uses its own constant; untouched here).

- [ ] **Step 7: Commit**

```powershell
git add src/routes/api/user/[id]/reports/weekly/+server.ts src/routes/api/user/[id]/reports/weekly/server.test.ts src/constants/training-report.constants.ts src/routes/app/running/reports/+page.svelte
git commit -m "feat(billing): tier-aware weekly-report cap (FREE 2 / SUPPORTER 15)"
```

---

## Task 7: Make the explain-run cap tier-aware

**Files:**

- Modify: `src/routes/api/user/[id]/activities/[activityId]/explain/+server.ts`
- Modify: `src/constants/training-report.constants.ts`

- [ ] **Step 1: Update the endpoint**

In `src/routes/api/user/[id]/activities/[activityId]/explain/+server.ts`:

1. Change the import on line 7 — drop `EXPLAIN_RUN_DAILY_LIMIT`, keep `EXPLAIN_QUESTION_MAX_LENGTH`:

```ts
import { EXPLAIN_QUESTION_MAX_LENGTH } from '@/constants/training-report.constants';
import { getLimit } from '@/constants/subscription.constants';
```

2. Replace the cap check (lines 52-57) with:

```ts
    const explainLimit = getLimit(locals.user.subscriptionTier, 'explainRunsPerDay');
    if ((usage?.count ?? 0) >= explainLimit) {
        return createResponse(429, {
            code: 'EXPLAIN_LIMIT_REACHED',
            message: `Daily limit of ${explainLimit} explanations reached. Try again tomorrow.`,
        });
    }
```

(`locals.user` is non-null here — the handler returns 403 at line 25-27 if `userId !== locals.user?.id`.)

- [ ] **Step 2: Remove the obsolete constant**

In `src/constants/training-report.constants.ts`, delete the `EXPLAIN_RUN_DAILY_LIMIT` comment + constant (originally lines 10-11). `EXPLAIN_QUESTION_MAX_LENGTH` and the rest stay.

- [ ] **Step 3: Update any explain endpoint test fixtures**

Run: `Grep` for `EXPLAIN_RUN_DAILY_LIMIT` across the repo.
Expected: zero matches after this task. If a test file references it, replace the assertion to drive the limit through the mocked `aiUsage.findUnique` count (FREE limit is now 1, so a count of `1` triggers the 429). Ensure the test's `locals.user` includes `subscriptionTier: 'FREE'`.

- [ ] **Step 4: Type-check**

Run: `npm run check`
Expected: PASS — no dangling references to either removed constant.

- [ ] **Step 5: Commit**

```powershell
git add src/routes/api/user/[id]/activities/[activityId]/explain/+server.ts src/constants/training-report.constants.ts
git commit -m "feat(billing): tier-aware explain-run cap (FREE 1 / SUPPORTER 5)"
```

---

## Task 8: Stripe client + Checkout endpoint

**Files:**

- Create: `src/lib/server/stripe.ts`
- Create: `src/routes/api/stripe/checkout/+server.ts`
- Test: `src/routes/api/stripe/checkout/server.test.ts`

- [ ] **Step 1: Create the Stripe client**

Create `src/lib/server/stripe.ts`:

```ts
import Stripe from 'stripe';
import { SECRET_STRIPE_KEY } from '$env/static/private';

export const stripe = new Stripe(SECRET_STRIPE_KEY, { apiVersion: '2024-06-20' });
```

- [ ] **Step 2: Write the failing test**

Create `src/routes/api/stripe/checkout/server.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$env/static/public', () => ({ PUBLIC_APP_ENV: 'development' }));
vi.mock('$env/static/private', () => ({
    SECRET_STRIPE_KEY: 'sk_test_x',
    STRIPE_PRICE_MONTHLY: 'price_monthly',
    STRIPE_PRICE_ANNUAL: 'price_annual',
    STRIPE_PRICE_LIFETIME: 'price_lifetime',
}));

const mocks = vi.hoisted(() => ({
    customersCreate: vi.fn(),
    sessionsCreate: vi.fn(),
    userFindUnique: vi.fn(),
    userUpdate: vi.fn(),
}));

vi.mock('$lib/server/stripe', () => ({
    stripe: {
        customers: { create: mocks.customersCreate },
        checkout: { sessions: { create: mocks.sessionsCreate } },
    },
}));

vi.mock('$lib/database', () => ({
    db: { user: { findUnique: mocks.userFindUnique, update: mocks.userUpdate } },
}));

import { POST } from './+server';

const locals = { user: { id: 'user-1', subscriptionTier: 'FREE' } } as unknown as App.Locals;

function makeRequest(body: unknown): Request {
    return new Request('http://localhost/api/stripe/checkout', {
        method: 'POST',
        body: JSON.stringify(body),
    });
}

beforeEach(() => {
    mocks.userFindUnique.mockResolvedValue({ stripeCustomerId: null, email: 'a@b.com' });
    mocks.customersCreate.mockResolvedValue({ id: 'cus_123' });
    mocks.sessionsCreate.mockResolvedValue({ url: 'https://checkout.stripe.com/x' });
});

afterEach(() => vi.clearAllMocks());

describe('POST /api/stripe/checkout', () => {
    it('rejects an unknown plan', async () => {
        const res = await POST({ request: makeRequest({ plan: 'bogus' }), locals } as never);
        expect(res.status).toBe(400);
    });

    it('creates a customer and a checkout session for the monthly plan', async () => {
        const res = await POST({ request: makeRequest({ plan: 'monthly' }), locals } as never);
        expect(res.status).toBe(200);
        expect(mocks.customersCreate).toHaveBeenCalledOnce();
        expect(mocks.sessionsCreate).toHaveBeenCalledWith(
            expect.objectContaining({
                mode: 'subscription',
                line_items: [{ price: 'price_monthly', quantity: 1 }],
                customer: 'cus_123',
            }),
        );
        const json = await res.json();
        expect(json.url).toBe('https://checkout.stripe.com/x');
    });

    it('uses payment mode for the lifetime plan', async () => {
        await POST({ request: makeRequest({ plan: 'lifetime' }), locals } as never);
        expect(mocks.sessionsCreate).toHaveBeenCalledWith(expect.objectContaining({ mode: 'payment' }));
    });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run src/routes/api/stripe/checkout/server.test.ts`
Expected: FAIL — `Cannot find module './+server'`.

- [ ] **Step 4: Implement the checkout endpoint**

Create `src/routes/api/stripe/checkout/+server.ts`:

```ts
import { stripe } from '$lib/server/stripe';
import { db } from '$lib/database';
import { createResponse } from '$lib/utils/response';
import { appConfig } from '@/constants/app.constants';
import { PUBLIC_APP_ENV } from '$env/static/public';
import { STRIPE_PRICE_ANNUAL, STRIPE_PRICE_LIFETIME, STRIPE_PRICE_MONTHLY } from '$env/static/private';

type PlanKey = 'monthly' | 'annual' | 'lifetime';

const PLANS: Record<PlanKey, { price: string; mode: 'subscription' | 'payment' }> = {
    monthly: { price: STRIPE_PRICE_MONTHLY, mode: 'subscription' },
    annual: { price: STRIPE_PRICE_ANNUAL, mode: 'subscription' },
    lifetime: { price: STRIPE_PRICE_LIFETIME, mode: 'payment' },
};

export async function POST({ request, locals }: { request: Request; locals: App.Locals }): Promise<Response> {
    if (!locals.user) return createResponse(401, { message: 'Unauthorized' });

    const body = await request.json().catch(() => null);
    const plan = body?.plan as PlanKey | undefined;
    const selected = plan ? PLANS[plan] : undefined;
    if (!selected) {
        return createResponse(400, { code: 'INVALID_PLAN', message: 'Unknown plan' });
    }

    const userId = locals.user.id;
    const dbUser = await db.user.findUnique({
        where: { id: userId },
        select: { stripeCustomerId: true, email: true },
    });

    let customerId = dbUser?.stripeCustomerId ?? null;
    if (!customerId) {
        const customer = await stripe.customers.create({
            email: dbUser?.email || undefined,
            metadata: { userId },
        });
        customerId = customer.id;
        await db.user.update({ where: { id: userId }, data: { stripeCustomerId: customerId } });
    }

    const baseUrl = PUBLIC_APP_ENV === 'development' ? appConfig.baseAppUrlDEV : appConfig.baseAppUrlPROD;

    const session = await stripe.checkout.sessions.create({
        customer: customerId,
        mode: selected.mode,
        line_items: [{ price: selected.price, quantity: 1 }],
        success_url: `${baseUrl}/my-account?checkout=success`,
        cancel_url: `${baseUrl}/my-account?checkout=cancel`,
        client_reference_id: userId,
        metadata: { userId, plan },
    });

    return createResponse(200, { url: session.url });
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/routes/api/stripe/checkout/server.test.ts`
Expected: PASS — all 3 cases.

- [ ] **Step 6: Commit**

```powershell
git add src/lib/server/stripe.ts src/routes/api/stripe/checkout/+server.ts src/routes/api/stripe/checkout/server.test.ts
git commit -m "feat(billing): add stripe client and checkout endpoint"
```

---

## Task 9: Stripe webhook endpoint

**Files:**

- Create: `src/routes/api/stripe/webhook/+server.ts`
- Test: `src/routes/api/stripe/webhook/server.test.ts`
- Modify: `src/hooks.server.ts`

- [ ] **Step 1: Whitelist the webhook path in hooks**

In `src/hooks.server.ts`, add the webhook to `publicPaths` (it must run with no session cookie — Stripe is unauthenticated and verifies via signature):

```ts
const publicPaths = new Set([
    '/',
    '/app',
    '/app/register',
    '/app/login',
    '/verification-mail-sent',
    '/privacy-policy',
    '/terms-of-use',
    '/api/stripe/webhook',
]);
```

- [ ] **Step 2: Write the failing test**

Create `src/routes/api/stripe/webhook/server.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$env/static/private', () => ({
    SECRET_STRIPE_KEY: 'sk_test_x',
    SECRET_STRIPE_WEBHOOK_SECRET: 'whsec_x',
}));

const mocks = vi.hoisted(() => ({
    constructEvent: vi.fn(),
    subscriptionsRetrieve: vi.fn(),
    userUpdate: vi.fn(),
    userFindFirst: vi.fn(),
}));

vi.mock('$lib/server/stripe', () => ({
    stripe: {
        webhooks: { constructEvent: mocks.constructEvent },
        subscriptions: { retrieve: mocks.subscriptionsRetrieve },
    },
}));

vi.mock('$lib/database', () => ({
    db: { user: { update: mocks.userUpdate, findFirst: mocks.userFindFirst } },
}));

import { POST } from './+server';

function makeRequest(): Request {
    return new Request('http://localhost/api/stripe/webhook', {
        method: 'POST',
        headers: { 'stripe-signature': 'sig' },
        body: '{}',
    });
}

beforeEach(() => {
    mocks.userUpdate.mockResolvedValue({});
    mocks.userFindFirst.mockResolvedValue({ id: 'user-1' });
});

afterEach(() => vi.clearAllMocks());

describe('POST /api/stripe/webhook', () => {
    it('returns 400 when signature verification fails', async () => {
        mocks.constructEvent.mockImplementation(() => {
            throw new Error('bad sig');
        });
        const res = await POST({ request: makeRequest() } as never);
        expect(res.status).toBe(400);
        expect(mocks.userUpdate).not.toHaveBeenCalled();
    });

    it('marks a lifetime supporter on a one-time checkout.session.completed', async () => {
        mocks.constructEvent.mockReturnValue({
            type: 'checkout.session.completed',
            data: { object: { mode: 'payment', metadata: { userId: 'user-1' }, customer: 'cus_1' } },
        });
        const res = await POST({ request: makeRequest() } as never);
        expect(res.status).toBe(200);
        expect(mocks.userUpdate).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: 'user-1' },
                data: expect.objectContaining({ lifetimeSupporter: true, subscriptionTier: 'SUPPORTER' }),
            }),
        );
    });

    it('writes subscription status on customer.subscription.updated', async () => {
        mocks.constructEvent.mockReturnValue({
            type: 'customer.subscription.updated',
            data: {
                object: {
                    customer: 'cus_1',
                    id: 'sub_1',
                    status: 'active',
                    current_period_end: Math.floor(Date.now() / 1000) + 86_400,
                },
            },
        });
        const res = await POST({ request: makeRequest() } as never);
        expect(res.status).toBe(200);
        expect(mocks.userUpdate).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: 'user-1' },
                data: expect.objectContaining({
                    subscriptionTier: 'SUPPORTER',
                    subscriptionStatus: 'active',
                    stripeSubscriptionId: 'sub_1',
                }),
            }),
        );
    });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run src/routes/api/stripe/webhook/server.test.ts`
Expected: FAIL — `Cannot find module './+server'`.

- [ ] **Step 4: Implement the webhook**

Create `src/routes/api/stripe/webhook/+server.ts`:

```ts
import { stripe } from '$lib/server/stripe';
import { db } from '$lib/database';
import { SECRET_STRIPE_WEBHOOK_SECRET } from '$env/static/private';
import type Stripe from 'stripe';

export async function POST({ request }: { request: Request }): Promise<Response> {
    const signature = request.headers.get('stripe-signature') ?? '';
    const payload = await request.text();

    let event: Stripe.Event;
    try {
        event = stripe.webhooks.constructEvent(payload, signature, SECRET_STRIPE_WEBHOOK_SECRET);
    } catch (err) {
        return new Response(`Webhook signature verification failed: ${(err as Error).message}`, { status: 400 });
    }

    switch (event.type) {
        case 'checkout.session.completed': {
            const session = event.data.object as Stripe.Checkout.Session;
            const userId = session.metadata?.userId ?? session.client_reference_id ?? undefined;
            if (!userId) break;

            if (session.mode === 'payment') {
                // One-time "lifetime" purchase.
                await db.user.update({
                    where: { id: userId },
                    data: {
                        lifetimeSupporter: true,
                        subscriptionTier: 'SUPPORTER',
                        stripeCustomerId: typeof session.customer === 'string' ? session.customer : undefined,
                    },
                });
            } else if (session.mode === 'subscription' && session.subscription) {
                const subId = typeof session.subscription === 'string' ? session.subscription : session.subscription.id;
                const sub = await stripe.subscriptions.retrieve(subId);
                await applySubscription(userId, sub);
            }
            break;
        }
        case 'customer.subscription.updated':
        case 'customer.subscription.deleted': {
            const sub = event.data.object as Stripe.Subscription;
            const userId = await userIdForCustomer(sub.customer);
            if (userId) await applySubscription(userId, sub);
            break;
        }
    }

    return new Response(JSON.stringify({ received: true }), { status: 200 });
}

async function applySubscription(userId: string, sub: Stripe.Subscription): Promise<void> {
    const isActive = sub.status === 'active' || sub.status === 'trialing';
    await db.user.update({
        where: { id: userId },
        data: {
            subscriptionTier: isActive ? 'SUPPORTER' : 'FREE',
            subscriptionStatus: sub.status,
            stripeSubscriptionId: sub.id,
            stripeCustomerId: typeof sub.customer === 'string' ? sub.customer : sub.customer.id,
            currentPeriodEnd: new Date(sub.current_period_end * 1000),
        },
    });
}

async function userIdForCustomer(customer: string | Stripe.Customer | Stripe.DeletedCustomer): Promise<string | null> {
    const customerId = typeof customer === 'string' ? customer : customer.id;
    const user = await db.user.findFirst({ where: { stripeCustomerId: customerId }, select: { id: true } });
    return user?.id ?? null;
}
```

> Note: `applySubscription` sets `subscriptionTier` directly so the value is correct even if `resolveTier` is bypassed, but the request-time `resolveTier` in `updateUser` remains the authority for access (it re-checks `currentPeriodEnd`).

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/routes/api/stripe/webhook/server.test.ts`
Expected: PASS — all 3 cases.

- [ ] **Step 6: Commit**

```powershell
git add src/routes/api/stripe/webhook/+server.ts src/routes/api/stripe/webhook/server.test.ts src/hooks.server.ts
git commit -m "feat(billing): add stripe webhook and whitelist its path"
```

---

## Task 10: Stripe Customer Portal endpoint

**Files:**

- Create: `src/routes/api/stripe/portal/+server.ts`
- Test: `src/routes/api/stripe/portal/server.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/routes/api/stripe/portal/server.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$env/static/public', () => ({ PUBLIC_APP_ENV: 'development' }));
vi.mock('$env/static/private', () => ({ SECRET_STRIPE_KEY: 'sk_test_x' }));

const mocks = vi.hoisted(() => ({
    portalCreate: vi.fn(),
    userFindUnique: vi.fn(),
}));

vi.mock('$lib/server/stripe', () => ({
    stripe: { billingPortal: { sessions: { create: mocks.portalCreate } } },
}));

vi.mock('$lib/database', () => ({
    db: { user: { findUnique: mocks.userFindUnique } },
}));

import { POST } from './+server';

const locals = { user: { id: 'user-1' } } as unknown as App.Locals;

beforeEach(() => {
    mocks.portalCreate.mockResolvedValue({ url: 'https://billing.stripe.com/p/x' });
});

afterEach(() => vi.clearAllMocks());

describe('POST /api/stripe/portal', () => {
    it('returns 400 when the user has no stripe customer', async () => {
        mocks.userFindUnique.mockResolvedValue({ stripeCustomerId: null });
        const res = await POST({ locals } as never);
        expect(res.status).toBe(400);
    });

    it('returns a portal url for a customer', async () => {
        mocks.userFindUnique.mockResolvedValue({ stripeCustomerId: 'cus_1' });
        const res = await POST({ locals } as never);
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.url).toBe('https://billing.stripe.com/p/x');
    });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/routes/api/stripe/portal/server.test.ts`
Expected: FAIL — `Cannot find module './+server'`.

- [ ] **Step 3: Implement the portal endpoint**

Create `src/routes/api/stripe/portal/+server.ts`:

```ts
import { stripe } from '$lib/server/stripe';
import { db } from '$lib/database';
import { createResponse } from '$lib/utils/response';
import { appConfig } from '@/constants/app.constants';
import { PUBLIC_APP_ENV } from '$env/static/public';

export async function POST({ locals }: { locals: App.Locals }): Promise<Response> {
    if (!locals.user) return createResponse(401, { message: 'Unauthorized' });

    const dbUser = await db.user.findUnique({
        where: { id: locals.user.id },
        select: { stripeCustomerId: true },
    });
    if (!dbUser?.stripeCustomerId) {
        return createResponse(400, { code: 'NO_CUSTOMER', message: 'No billing account found' });
    }

    const baseUrl = PUBLIC_APP_ENV === 'development' ? appConfig.baseAppUrlDEV : appConfig.baseAppUrlPROD;
    const session = await stripe.billingPortal.sessions.create({
        customer: dbUser.stripeCustomerId,
        return_url: `${baseUrl}/my-account`,
    });

    return createResponse(200, { url: session.url });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/routes/api/stripe/portal/server.test.ts`
Expected: PASS — both cases.

- [ ] **Step 5: Commit**

```powershell
git add src/routes/api/stripe/portal/+server.ts src/routes/api/stripe/portal/server.test.ts
git commit -m "feat(billing): add stripe customer portal endpoint"
```

---

## Task 11: Billing UI on the account page

**Files:**

- Create: `src/lib/components/billing/BillingPanel.svelte`
- Modify: `src/routes/app/my-account/+page.svelte`

- [ ] **Step 1: Create the billing panel component**

Create `src/lib/components/billing/BillingPanel.svelte`:

```svelte
<script lang="ts">
    import { getToastStore } from '@skeletonlabs/skeleton';
    import { makeToast } from '$lib/utils/toasts.js';
    import type { SubscriptionTier } from '@/constants/subscription.constants';

    export let tier: SubscriptionTier;

    const toastStore = getToastStore();
    let loading = false;

    async function startCheckout(plan: 'monthly' | 'annual' | 'lifetime') {
        loading = true;
        try {
            const res = await fetch('/api/stripe/checkout', {
                method: 'POST',
                body: JSON.stringify({ plan }),
            });
            const json = await res.json();
            if (res.ok && json.url) {
                window.location.href = json.url;
                return;
            }
            makeToast(toastStore, json.message ?? 'Could not start checkout', 'variant-filled-error');
        } catch {
            makeToast(toastStore, 'Could not start checkout', 'variant-filled-error');
        }
        loading = false;
    }

    async function openPortal() {
        loading = true;
        try {
            const res = await fetch('/api/stripe/portal', { method: 'POST' });
            const json = await res.json();
            if (res.ok && json.url) {
                window.location.href = json.url;
                return;
            }
            makeToast(toastStore, json.message ?? 'Could not open billing portal', 'variant-filled-error');
        } catch {
            makeToast(toastStore, 'Could not open billing portal', 'variant-filled-error');
        }
        loading = false;
    }
</script>

<div class="mt-8 border rounded border-solid border-surface-500 p-5">
    <h3 class="h3 mb-2">Subscription</h3>
    <p class="mb-4">
        Current plan:
        <span class="font-bold text-secondary-400">{tier === 'SUPPORTER' ? 'Supporter' : 'Free'}</span>
    </p>

    {#if tier === 'SUPPORTER'}
        <button type="button" class="btn variant-soft-primary" disabled={loading} on:click={openPortal}>
            Manage subscription
        </button>
    {:else}
        <p class="mb-3 text-sm opacity-80">
            Support GymCraft and unlock higher limits: 15 weekly reports/month and 5 run explanations/day.
        </p>
        <div class="flex flex-wrap gap-3">
            <button type="button" class="btn variant-filled-primary" disabled={loading} on:click={() => startCheckout('monthly')}>
                €4 / month
            </button>
            <button type="button" class="btn variant-soft-primary" disabled={loading} on:click={() => startCheckout('annual')}>
                €36 / year
            </button>
            <button type="button" class="btn variant-soft-secondary" disabled={loading} on:click={() => startCheckout('lifetime')}>
                €25 lifetime
            </button>
        </div>
    {/if}
</div>
```

> The `SubscriptionTier` type is imported from `src/constants/subscription.constants.ts` (client-safe), so this component builds cleanly into the client bundle.

- [ ] **Step 2: Render it on the account page**

In `src/routes/app/my-account/+page.svelte`:

1. Add the import after the existing imports (after line 9):

```ts
    import BillingPanel from '$lib/components/billing/BillingPanel.svelte';
```

2. Add the panel inside the `<Card>`, after the `Plans left` paragraph (line 55):

```svelte
    <p>Plans left: {user.plansLeft}</p>
    <BillingPanel tier={user.subscriptionTier} />
```

- [ ] **Step 3: Type-check and lint**

Run: `npm run check` then `npm run lint`
Expected: PASS for both.

- [ ] **Step 4: Commit**

```powershell
git add src/lib/components/billing/BillingPanel.svelte src/routes/app/my-account/+page.svelte
git commit -m "feat(billing): add subscription panel to account page"
```

---

## Task 12: Full verification

**Files:** (none modified unless tidy-ups are needed)

- [ ] **Step 1: Run the full test suite**

Run: `npm run test`
Expected: PASS — no failures.

- [ ] **Step 2: Format, lint, typecheck**

Run: `npm run format-check`, then `npm run lint`, then `npm run check`
Expected: all three PASS. (If `format-check` fails, run `npm run format` and commit the result.)

- [ ] **Step 3: Manual smoke — free user sees upgrade options**

Run: `npm run dev` (ensure all five `STRIPE_*` env vars exist in `.env`, even as test placeholders, or the build fails).
Steps:

1. Log in as a test user (tier defaults to FREE).
2. Visit `/app/my-account` → confirm the "Subscription" panel shows **Free** plus the three price buttons.
3. Visit `/app/running/reports` → confirm the counter reads `{N}/2 used this month`.

- [ ] **Step 4: Manual smoke — Stripe test checkout (optional but recommended)**

With real Stripe **test-mode** keys + price IDs in `.env`, and the Stripe CLI forwarding webhooks (`stripe listen --forward-to localhost:5173/api/stripe/webhook`):

1. Click **€4 / month**, complete checkout with card `4242 4242 4242 4242`.
2. Confirm the webhook fires (`checkout.session.completed`) and the user row gains `subscriptionTier = SUPPORTER`, `subscriptionStatus = active`, `currentPeriodEnd` in the future.
3. Reload `/app/my-account` → panel now shows **Supporter** + a **Manage subscription** button.
4. Reload `/app/running/reports` → counter now reads `{N}/15`.

- [ ] **Step 5: Final commit (only if tidy-ups were needed)**

```powershell
git status
# If clean, no commit needed.
```

---

## Notes for the executing engineer

- **`locals.user` is the tier authority for reads.** Every request recomputes the tier via `resolveTier` in `updateUser`, so an expired subscription downgrades access immediately even before Stripe sends `customer.subscription.deleted`. The webhook's writes are the source of truth for the stored fields; `resolveTier` is the gate.
- **Webhook must not require a session.** It is whitelisted in `hooks.server.ts` and authenticates via Stripe's signature. Do not add session/ownership checks to it.
- **Stripe API version** is pinned to `2024-06-20` in `src/lib/server/stripe.ts`. If the installed `stripe` package's types demand a different literal, use the version string its types expect — do not loosen the type with `as any`.
- **Server boundary:** `TIER_LIMITS` and `SubscriptionTier` live in `src/constants/subscription.constants.ts` (not `$lib/server`) specifically because `.svelte` components import them. Only `resolveTier` is server-located. Do not move the limits under `$lib/server` — it would break the client build.
- **Phase 2 (separate plan)** picks up: gym-plan monthly tiering for supporters (lifetime→monthly via `AiUsage` `kind='gym_plan'`), the smarter-model swap by tier, 120-day Garmin backfill, report export, and the supporter badge. It will extend `TierLimits` with the additional fields.
- **No data migration needed.** Existing users default to `subscriptionTier = FREE`, `lifetimeSupporter = false`, all Stripe fields null — correct starting state.
