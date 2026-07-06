# Subscription — Phase 2 (Premium Features) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the Supporter-tier premium features on top of Phase 1: gym-plan monthly tiering (SUPPORTER 5/month vs FREE 10 lifetime), tier-based AI model selection, tiered Garmin backfill (FREE 60d / SUPPORTER 120d), weekly-report Markdown export, and a supporter badge.

**Architecture:** Extend the Phase 1 `TIER_LIMITS` map with the Phase 2 fields so every gate keeps one source of truth. The tier is already on `locals.user.subscriptionTier` (server) and `$page.data.user.subscriptionTier` (client) — Phase 2 only threads it into the gym-plan cap, the proxy-call bodies, and the backfill window math. Gym-plan supporter usage is tracked via `AiUsage` with `kind='gym_plan'` and `day=first-of-month`, mirroring the weekly-report pattern.

**Tech Stack:** SvelteKit (Svelte 4), Prisma + PostgreSQL, Vitest, TypeScript.

**Source spec:** `docs/superpowers/specs/2026-06-30-marketing-business-model-design.md` (§2.1 tier table, §3.5 feature gating). Phase 1 landed on `feat/subscription` (see `docs/superpowers/plans/2026-07-01-subscription-phase-1.md`).

**Scope decisions (read before executing):**

- **Gym-plan model swap is out of scope.** The gym-plan generation request is built in the browser and posted directly to the AI proxy (`create-plan/+page.svelte`), so any client-chosen model is spoofable. The model swap applies to the two server-side proxy calls (weekly report, explain run). The gym-plan proxy keeps choosing its own model.
- **Export is Markdown only.** The spec says "PDF/MD"; PDF needs a heavy dependency (puppeteer/pdfkit) for a hobby feature. Markdown ships now; PDF is deferred until someone asks.
- **FREE keeps the lifetime gym-plan cap** (Configuration `generalPlanLimit` − `User.generatedPlansNumber`). Supporters get 5/month via `AiUsage`. `generatedPlansNumber` still increments for supporters (analytics + the value a canceled supporter reverts to). A heavy supporter who cancels may see 0 free plans left — intended.
- **Wire-shape change:** the proxy request body gains an optional `model` field. `.ai/WEEKLY_REPORT_PROXY_SPEC.md` and `.ai/EXPLAIN_RUN_PROXY_SPEC.md` must be updated (CLAUDE.md rule). The Express proxy ignores unknown fields until it's updated, so this is backward-compatible.

---

## File Structure

**Create:**

- `src/lib/server/reports/export-markdown.ts` — pure `buildReportMarkdown()` for the export payload.
- `src/lib/server/reports/export-markdown.test.ts` — tests for the builder.
- `src/routes/api/user/[id]/reports/weekly/[reportId]/export/+server.ts` — supporter-gated GET returning a `.md` download.
- `src/routes/api/user/[id]/reports/weekly/[reportId]/export/server.test.ts` — endpoint tests.
- `src/routes/api/plans/server.test.ts` — tests for the tier-aware plans cap.
- `src/lib/components/billing/SupporterBadge.svelte` — small chip shown next to the username.

**Modify:**

- `src/constants/subscription.constants.ts` — extend `TierLimits` with `gymPlansPerMonth`, `garminBackfillDays`, `aiModel`.
- `src/constants/subscription.constants.test.ts` — cover the new fields.
- `src/lib/server/reports/call-proxy.ts` — optional `model` in both proxy bodies.
- `src/routes/api/user/[id]/reports/weekly/+server.ts` — pass tier model + tier backfill days.
- `src/routes/api/user/[id]/reports/weekly/server.test.ts` — assert the new args.
- `src/routes/api/user/[id]/activities/[activityId]/explain/+server.ts` — pass tier model.
- `src/lib/garmin/sync-window.ts` — `resolveSyncWindow` takes `backfillDays`; drop `BACKFILL_DAYS`.
- `src/lib/garmin/sync-window.test.ts` — update for the new signature.
- `src/lib/server/garmin/sync-activities.ts` — thread `backfillDays` through sync/persist.
- `src/routes/api/user/[id]/garmin/sync/+server.ts` — pass tier days on both paths.
- `src/routes/api/user/[id]/garmin/sync/server.test.ts` — update asserts.
- `src/lib/garmin/run-proxy-sync.ts` — `RunProxySyncArgs.backfillDays`.
- `src/lib/garmin/run-proxy-sync.test.ts` — update fixtures.
- `src/routes/app/running/+page.svelte`, `src/routes/app/running/analytics/+page.svelte` — pass tier days to `runProxySync`.
- `src/lib/prisma/prisma.ts` — `getMonthlyGymPlanCount` + `incrementMonthlyGymPlanCount`.
- `src/routes/api/plans/+server.ts` — supporter monthly branch.
- `src/lib/utils/user.ts` — supporter `plansLeft` = monthly remaining.
- `src/routes/app/running/analytics/reports/[id]/+page.svelte` — export button.
- `src/routes/app/my-account/+page.svelte` — supporter badge next to the name.
- `.ai/WEEKLY_REPORT_PROXY_SPEC.md`, `.ai/EXPLAIN_RUN_PROXY_SPEC.md` — document the `model` field.

---

## Task 1: Extend TIER_LIMITS with the Phase 2 fields

**Files:**

- Modify: `src/constants/subscription.constants.ts`
- Test: `src/constants/subscription.constants.test.ts`

- [ ] **Step 1: Add failing assertions**

In `src/constants/subscription.constants.test.ts`, extend the two existing `TIER_LIMITS` tests:

```ts
    it('encodes the agreed FREE caps', () => {
        expect(TIER_LIMITS.FREE.weeklyReportsPerMonth).toBe(2);
        expect(TIER_LIMITS.FREE.explainRunsPerDay).toBe(1);
        expect(TIER_LIMITS.FREE.gymPlansPerMonth).toBeNull();
        expect(TIER_LIMITS.FREE.garminBackfillDays).toBe(60);
        expect(TIER_LIMITS.FREE.aiModel).toBe('gpt-5.4-mini');
    });

    it('encodes the agreed SUPPORTER caps', () => {
        expect(TIER_LIMITS.SUPPORTER.weeklyReportsPerMonth).toBe(15);
        expect(TIER_LIMITS.SUPPORTER.explainRunsPerDay).toBe(5);
        expect(TIER_LIMITS.SUPPORTER.gymPlansPerMonth).toBe(5);
        expect(TIER_LIMITS.SUPPORTER.garminBackfillDays).toBe(120);
        expect(TIER_LIMITS.SUPPORTER.aiModel).toBe('gpt-5.4');
    });
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/constants/subscription.constants.test.ts`
Expected: FAIL — the new properties are undefined.

- [ ] **Step 3: Implement**

Replace the interface + map in `src/constants/subscription.constants.ts`:

```ts
export type SubscriptionTier = 'FREE' | 'SUPPORTER';

// Single source of truth for tier gating.
// gymPlansPerMonth: null means the legacy lifetime cap applies
// (Configuration generalPlanLimit − User.generatedPlansNumber).
export interface TierLimits {
    weeklyReportsPerMonth: number;
    explainRunsPerDay: number;
    gymPlansPerMonth: number | null;
    garminBackfillDays: number;
    aiModel: string;
}

export const TIER_LIMITS: Record<SubscriptionTier, TierLimits> = {
    FREE: {
        weeklyReportsPerMonth: 2,
        explainRunsPerDay: 1,
        gymPlansPerMonth: null,
        garminBackfillDays: 60,
        aiModel: 'gpt-5.4-mini',
    },
    SUPPORTER: {
        weeklyReportsPerMonth: 15,
        explainRunsPerDay: 5,
        gymPlansPerMonth: 5,
        garminBackfillDays: 120,
        aiModel: 'gpt-5.4',
    },
};
```

(`getLimit` needs no change — it's generic over `keyof TierLimits`.)

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/constants/subscription.constants.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/constants/subscription.constants.ts src/constants/subscription.constants.test.ts
git commit -m "feat(billing): extend tier limits with phase 2 caps"
```

---

## Task 2: Tier-based AI model for weekly report + explain run

**Files:**

- Modify: `src/lib/server/reports/call-proxy.ts`
- Modify: `src/routes/api/user/[id]/reports/weekly/+server.ts`
- Modify: `src/routes/api/user/[id]/activities/[activityId]/explain/+server.ts`
- Modify: `src/routes/api/user/[id]/reports/weekly/server.test.ts`
- Modify: `.ai/WEEKLY_REPORT_PROXY_SPEC.md`, `.ai/EXPLAIN_RUN_PROXY_SPEC.md`

- [ ] **Step 1: Add the failing assertion**

In `src/routes/api/user/[id]/reports/weekly/server.test.ts`, find the happy-path test that asserts `callWeeklyReportProxy` was called and add a model assertion (the `locals` fixture is FREE):

```ts
    it('passes the tier AI model to the report proxy', async () => {
        const response = await POST({ request: makeRequest(validBody), params: { id: userId }, locals });
        expect(response.status).toBe(200);
        expect(mocks.callWeeklyReportProxy).toHaveBeenCalledWith(expect.anything(), 'gpt-5.4-mini');
    });
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run "src/routes/api/user/[id]/reports/weekly/server.test.ts"`
Expected: FAIL — called with 1 argument, not 2.

- [ ] **Step 3: Extend `call-proxy.ts`**

In `src/lib/server/reports/call-proxy.ts`:

```ts
export async function callWeeklyReportProxy(prompt: ReportPrompt, model?: string): Promise<CallProxyResult> {
    const url = isProduction() ? appConfig.weeklyReportApiUrlPROD : appConfig.weeklyReportApiUrlDEV;
    const result = await postPrompt(url, prompt, model);
    if (!result.ok) return { ok: false, error: result.error };

    const summary = typeof result.data?.summary === 'string' ? result.data.summary.trim() : null;
    if (!summary) return { ok: false, error: 'Empty proxy summary' };
    return { ok: true, summary };
}

export async function callExplainRunProxy(prompt: ExplainPrompt, model?: string): Promise<CallExplainProxyResult> {
    const url = isProduction() ? appConfig.explainRunApiUrlPROD : appConfig.explainRunApiUrlDEV;
    const result = await postPrompt(url, prompt, model);
    if (!result.ok) return { ok: false, error: result.error };

    const analysis = typeof result.data?.analysis === 'string' ? result.data.analysis.trim() : null;
    if (!analysis) return { ok: false, error: 'Empty proxy analysis' };
    return { ok: true, analysis };
}
```

And in `postPrompt`, accept + forward the model:

```ts
async function postPrompt(
    url: string,
    prompt: { system: string; user: string },
    model?: string,
): Promise<{ ok: true; data: Record<string, unknown> } | { ok: false; error: string }> {
```

with the body line becoming:

```ts
            body: JSON.stringify({ system: prompt.system, user: prompt.user, ...(model ? { model } : {}) }),
```

- [ ] **Step 4: Pass the tier model from both endpoints**

In `src/routes/api/user/[id]/reports/weekly/+server.ts` (line ~146):

```ts
    const proxy = await callWeeklyReportProxy(prompt, getLimit(locals.user.subscriptionTier, 'aiModel'));
```

(`getLimit` is already imported there from Phase 1.)

In `src/routes/api/user/[id]/activities/[activityId]/explain/+server.ts` (line ~108):

```ts
    const proxy = await callExplainRunProxy(prompt, getLimit(locals.user.subscriptionTier, 'aiModel'));
```

(`getLimit` is already imported there from Phase 1.)

- [ ] **Step 5: Run to verify pass**

Run: `npx vitest run "src/routes/api/user/[id]/reports/weekly/server.test.ts"`
Expected: PASS — all tests.

- [ ] **Step 6: Update the proxy spec docs**

In `.ai/WEEKLY_REPORT_PROXY_SPEC.md` and `.ai/EXPLAIN_RUN_PROXY_SPEC.md`, extend the "Request body" block in each:

```ts
{
    system: string; // System prompt (role instructions). Pre-built by the caller.
    user: string; // User prompt (data payload). Pre-built by the caller.
    model?: string; // Optional OpenAI model override (subscription tier based).
                    // When present, use it for the completion instead of the default.
                    // When absent, keep the endpoint's current default model.
}
```

Add one sentence below each: "The main app sends `model` based on the user's subscription tier (`gpt-5.4-mini` for free users, `gpt-5.4` for supporters). Validate it against an allowlist of known model ids and fall back to the default when invalid."

- [ ] **Step 7: Commit**

```powershell
git add src/lib/server/reports/call-proxy.ts "src/routes/api/user/[id]/reports/weekly/+server.ts" "src/routes/api/user/[id]/activities/[activityId]/explain/+server.ts" "src/routes/api/user/[id]/reports/weekly/server.test.ts" .ai/WEEKLY_REPORT_PROXY_SPEC.md .ai/EXPLAIN_RUN_PROXY_SPEC.md
git commit -m "feat(billing): tier-based AI model for report and explain proxies"
```

---

## Task 3: Tiered Garmin backfill (FREE 60 / SUPPORTER 120)

**Files:**

- Modify: `src/lib/garmin/sync-window.ts`
- Modify: `src/lib/garmin/sync-window.test.ts`
- Modify: `src/lib/server/garmin/sync-activities.ts`
- Modify: `src/routes/api/user/[id]/garmin/sync/+server.ts`
- Modify: `src/routes/api/user/[id]/garmin/sync/server.test.ts`
- Modify: `src/lib/garmin/run-proxy-sync.ts`
- Modify: `src/lib/garmin/run-proxy-sync.test.ts`
- Modify: `src/routes/app/running/+page.svelte`
- Modify: `src/routes/app/running/analytics/+page.svelte`
- Modify: `src/routes/api/user/[id]/reports/weekly/+server.ts`

- [ ] **Step 1: Update `sync-window.ts` — days becomes a parameter**

Replace `export const BACKFILL_DAYS = 90;` (delete the constant) and change `resolveSyncWindow`:

```ts
export function resolveSyncWindow(
    syncState: SyncStateSnapshot | null,
    backfillDays: number,
    now: Date = new Date(),
): SyncWindow {
    const endDate = now;

    if (!syncState || !syncState.backfillComplete) {
        const start = new Date(endDate);
        start.setUTCDate(start.getUTCDate() - backfillDays);
        return { mode: 'backfill', startDate: toIsoDate(start), endDate: toIsoDate(endDate) };
    }

    const lastSyncedAt = syncState.lastSyncedAt ? new Date(syncState.lastSyncedAt) : null;
    const start = pickIncrementalStart(lastSyncedAt, endDate);
    return { mode: 'incremental', startDate: toIsoDate(start), endDate: toIsoDate(endDate) };
}
```

- [ ] **Step 2: Update `sync-window.test.ts`**

Every `resolveSyncWindow(...)` call gains a days argument. Open the file; each existing call like `resolveSyncWindow(null, now)` becomes `resolveSyncWindow(null, 60, now)` (and the expected backfill start date shifts accordingly — recompute: the backfill case asserts a start `BACKFILL_DAYS` before `now`; with 60 the expected ISO date moves 30 days later). Add one new case proving the parameter matters:

```ts
    it('uses the provided backfillDays for the backfill window', () => {
        const now = new Date('2026-07-01T00:00:00Z');
        const sixty = resolveSyncWindow(null, 60, now);
        const oneTwenty = resolveSyncWindow(null, 120, now);
        expect(sixty.startDate).toBe('2026-05-02');
        expect(oneTwenty.startDate).toBe('2026-03-03');
    });
```

Run: `npx vitest run src/lib/garmin/sync-window.test.ts` — iterate until PASS.

- [ ] **Step 3: Thread days through `sync-activities.ts`**

The import of `BACKFILL_DAYS` goes away. New signatures (all existing bodies otherwise unchanged):

```ts
export async function syncUserActivities(userId: string, backfillDays: number): Promise<SyncResult> {
    const state = await db.garminSyncState.findUnique({ where: { userId } });
    if (!state || !state.backfillComplete) {
        return runBackfill(userId, backfillDays);
    }
    return runIncremental(userId, state.lastSyncedAt);
}

export async function backfillUser(userId: string, backfillDays: number): Promise<SyncResult> {
    return runBackfill(userId, backfillDays);
}

export async function incrementalSync(userId: string, backfillDays: number): Promise<SyncResult> {
    const state = await db.garminSyncState.findUnique({ where: { userId } });
    if (!state || !state.backfillComplete) {
        return runBackfill(userId, backfillDays);
    }
    return runIncremental(userId, state.lastSyncedAt);
}

async function runBackfill(userId: string, backfillDays: number): Promise<SyncResult> {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setUTCDate(startDate.getUTCDate() - backfillDays);
    // ... rest unchanged, but the persist call becomes:
    return persistActivities(userId, result.activities, 'backfill', backfillDays);
}
```

`persistActivities` gains the parameter (used only for the empty-list fallback date):

```ts
export async function persistActivities(
    userId: string,
    activities: GarminActivity[],
    mode: SyncMode,
    backfillDays: number,
): Promise<SyncResult> {
```

with the fallback line inside the `mode === 'backfill'` branch becoming:

```ts
        fallbackOldest.setUTCDate(fallbackOldest.getUTCDate() - backfillDays);
```

`runIncremental` calls `persistActivities(userId, result.activities, 'incremental', 0)` — the days value is unused on the incremental path; pass `0`.

- [ ] **Step 4: Pass tier days in the two API endpoints**

In `src/routes/api/user/[id]/garmin/sync/+server.ts`, both paths need the tier. Add the import:

```ts
import { getLimit } from '@/constants/subscription.constants';
```

The fallback path (line ~36):

```ts
    const result = await syncUserActivities(userId, getLimit(locals.user.subscriptionTier, 'garminBackfillDays'));
```

`persistFromClient` gains a `backfillDays` parameter — change the call at line ~31 to:

```ts
        return persistFromClient(userId, body, getLimit(locals.user.subscriptionTier, 'garminBackfillDays'));
```

and the function signature + persist call:

```ts
async function persistFromClient(
    userId: string,
    body: { activities: unknown; mode?: unknown },
    backfillDays: number,
): Promise<Response> {
    // ...
        const result = await persistActivities(userId, mapped, serverMode, backfillDays);
```

In `src/routes/api/user/[id]/reports/weekly/+server.ts` (line ~86):

```ts
    const syncResult = await syncUserActivities(userId, getLimit(locals.user.subscriptionTier, 'garminBackfillDays'));
```

- [ ] **Step 5: Update the garmin sync endpoint test**

In `src/routes/api/user/[id]/garmin/sync/server.test.ts`:

1. The `locals` fixture user needs `subscriptionTier: 'FREE'` (find where `locals` is built; add the field).
2. Line ~144 changes from `expect(mocks.syncUserActivities).toHaveBeenCalledWith(userId)` to:

```ts
        expect(mocks.syncUserActivities).toHaveBeenCalledWith(userId, 60);
```

3. If any test asserts `persistActivities` call args, append `60` as the fourth arg.

Run: `npx vitest run "src/routes/api/user/[id]/garmin/sync/server.test.ts"` — PASS.

- [ ] **Step 6: Thread days through the client sync helper**

In `src/lib/garmin/run-proxy-sync.ts`:

```ts
export interface RunProxySyncArgs {
    userId: string;
    garminEmail: string | null;
    syncState: SyncStateSnapshot | null;
    /** Opaque Garmin session token (Bearer). When absent, the caller must prompt for a login. */
    sessionToken: string | null;
    /** Tier-based backfill window (TIER_LIMITS[tier].garminBackfillDays). */
    backfillDays: number;
}
```

and inside `runProxySync`:

```ts
    const { userId, garminEmail, syncState, sessionToken, backfillDays } = args;
    // ...
    const { mode, startDate, endDate } = resolveSyncWindow(syncState, backfillDays);
```

In `src/lib/garmin/run-proxy-sync.test.ts`, add `backfillDays: 60` to every `runProxySync({ ... })` call object.

Run: `npx vitest run src/lib/garmin/run-proxy-sync.test.ts` — PASS.

- [ ] **Step 7: Update the two page callers**

In `src/routes/app/running/+page.svelte` and `src/routes/app/running/analytics/+page.svelte`, add the import:

```ts
    import { TIER_LIMITS } from '@/constants/subscription.constants';
```

and extend each `runProxySync({ ... })` call:

```ts
            const result = await runProxySync({
                userId: $page.data.user?.id ?? '',
                garminEmail: data.garminEmail,
                sessionToken,
                syncState: data.syncState,
                backfillDays: TIER_LIMITS[$page.data.user.subscriptionTier].garminBackfillDays,
            });
```

(Match each file's existing arg names — the analytics page may differ slightly; keep its existing values and only add `backfillDays`.)

- [ ] **Step 8: Verify no stale references and run affected tests**

Run: `Grep` for `BACKFILL_DAYS` across `src/` — expected: zero matches.
Run: `npx vitest run src/lib/garmin "src/routes/api/user/[id]/garmin/sync/server.test.ts" "src/routes/api/user/[id]/reports/weekly/server.test.ts"`
Expected: PASS.
Run: `npm run check` — expected: only the 2 pre-existing `vite.config.ts` errors.

- [ ] **Step 9: Commit**

```powershell
git add src/lib/garmin src/lib/server/garmin/sync-activities.ts "src/routes/api/user/[id]/garmin/sync" "src/routes/api/user/[id]/reports/weekly/+server.ts" src/routes/app/running
git commit -m "feat(billing): tier-based garmin backfill window (FREE 60d / SUPPORTER 120d)"
```

---

## Task 4: Gym-plan monthly cap for supporters

**Files:**

- Modify: `src/lib/prisma/prisma.ts`
- Modify: `src/routes/api/plans/+server.ts`
- Modify: `src/lib/utils/user.ts`
- Create: `src/routes/api/plans/server.test.ts`

- [ ] **Step 1: Add the prisma helpers**

In `src/lib/prisma/prisma.ts`, directly below `getMonthlyWeeklyReportCount` (line ~409), add:

```ts
export async function getMonthlyGymPlanCount(userId: string): Promise<number> {
    // NOT cached — mirrors getMonthlyWeeklyReportCount; pre-flight hint only.
    const monthKey = currentMonthStartIso();
    const row = await db.aiUsage.findUnique({
        where: { userId_kind_day: { userId, kind: 'gym_plan', day: monthKey } },
        select: { count: true },
    });
    return row?.count ?? 0;
}

export async function incrementMonthlyGymPlanCount(userId: string): Promise<void> {
    const monthKey = currentMonthStartIso();
    await db.aiUsage.upsert({
        where: { userId_kind_day: { userId, kind: 'gym_plan', day: monthKey } },
        create: { userId, kind: 'gym_plan', day: monthKey, count: 1 },
        update: { count: { increment: 1 } },
    });
}
```

- [ ] **Step 2: Write the failing endpoint test**

Create `src/routes/api/plans/server.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$env/static/public', () => ({ PUBLIC_APP_ENV: 'test' }));

const mocks = vi.hoisted(() => ({
    addPlan: vi.fn(),
    getGeneralPlanLimit: vi.fn(),
    getGeneratedPlansNumber: vi.fn(),
    updateGeneratedPlansNumber: vi.fn(),
    getMonthlyGymPlanCount: vi.fn(),
    incrementMonthlyGymPlanCount: vi.fn(),
}));

vi.mock('$lib/prisma/prisma', () => ({
    addPlan: mocks.addPlan,
    getGeneralPlanLimit: mocks.getGeneralPlanLimit,
    getGeneratedPlansNumber: mocks.getGeneratedPlansNumber,
    updateGeneratedPlansNumber: mocks.updateGeneratedPlansNumber,
    getMonthlyGymPlanCount: mocks.getMonthlyGymPlanCount,
    incrementMonthlyGymPlanCount: mocks.incrementMonthlyGymPlanCount,
}));

import { POST } from './+server';

const plan = { description: 'desc', workouts: [] };

function makeEvent(tier: 'FREE' | 'SUPPORTER') {
    return {
        request: new Request('http://localhost/api/plans', { method: 'POST', body: JSON.stringify({ plan }) }),
        locals: { user: { id: 'user-1', name: 'u', role: 'USER', subscriptionTier: tier } },
    } as never;
}

beforeEach(() => {
    mocks.getGeneralPlanLimit.mockResolvedValue(10);
    mocks.getGeneratedPlansNumber.mockResolvedValue(3);
    mocks.getMonthlyGymPlanCount.mockResolvedValue(0);
    mocks.addPlan.mockResolvedValue({ id: 'plan-1' });
    mocks.updateGeneratedPlansNumber.mockResolvedValue(4);
    mocks.incrementMonthlyGymPlanCount.mockResolvedValue(undefined);
});

afterEach(() => vi.clearAllMocks());

describe('POST /api/plans — FREE tier (lifetime cap)', () => {
    it('saves the plan and returns lifetime plansLeft', async () => {
        const res = await POST(makeEvent('FREE'));
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.plansLeft).toBe(6); // 10 - 4
        expect(mocks.incrementMonthlyGymPlanCount).not.toHaveBeenCalled();
    });

    it('rejects when the lifetime cap is reached', async () => {
        mocks.getGeneratedPlansNumber.mockResolvedValue(10);
        const res = await POST(makeEvent('FREE'));
        expect(res.status).toBe(400);
        expect(mocks.addPlan).not.toHaveBeenCalled();
    });
});

describe('POST /api/plans — SUPPORTER tier (monthly cap)', () => {
    it('saves the plan, increments the monthly counter, and returns monthly plansLeft', async () => {
        mocks.getMonthlyGymPlanCount.mockResolvedValue(2);
        const res = await POST(makeEvent('SUPPORTER'));
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.plansLeft).toBe(2); // 5 - (2 + 1)
        expect(mocks.incrementMonthlyGymPlanCount).toHaveBeenCalledWith('user-1');
    });

    it('rejects when the monthly cap is reached', async () => {
        mocks.getMonthlyGymPlanCount.mockResolvedValue(5);
        const res = await POST(makeEvent('SUPPORTER'));
        expect(res.status).toBe(400);
        expect(mocks.addPlan).not.toHaveBeenCalled();
    });

    it('ignores the lifetime counter for supporters', async () => {
        mocks.getGeneratedPlansNumber.mockResolvedValue(10); // over lifetime cap
        mocks.getMonthlyGymPlanCount.mockResolvedValue(0);
        const res = await POST(makeEvent('SUPPORTER'));
        expect(res.status).toBe(200);
    });
});
```

- [ ] **Step 3: Run to verify failure**

Run: `npx vitest run src/routes/api/plans/server.test.ts`
Expected: FAIL (endpoint doesn't know about tiers yet; supporter cases break).

- [ ] **Step 4: Rewrite the plans endpoint**

Replace the body of `src/routes/api/plans/+server.ts` with:

```ts
import { NewPlan, Plan } from './../../../models/plan/plan.model';
import {
    addPlan,
    getGeneralPlanLimit,
    getGeneratedPlansNumber,
    getMonthlyGymPlanCount,
    incrementMonthlyGymPlanCount,
    updateGeneratedPlansNumber,
} from '$lib/prisma/prisma';
import { createResponse } from '$lib/utils/response';
import { getAuthenticatedUser } from '$lib/server/auth';
import { getLimit } from '@/constants/subscription.constants';
import { to } from 'await-to-js';
import type { RequestEvent } from './$types';

export async function POST(event: RequestEvent): Promise<Response> {
    const user = getAuthenticatedUser(event);
    const body = await event.request.json();
    const { plan }: { plan: Plan } = body;
    const userId = user.id;
    const tier = event.locals.user.subscriptionTier;
    const monthlyCap = getLimit(tier, 'gymPlansPerMonth');

    // Pre-flight cap check: supporters get a monthly allowance; free users keep
    // the legacy lifetime cap (Configuration limit − generatedPlansNumber).
    let generatedPlansNumber = -1;
    let monthlyCount = 0;
    if (monthlyCap !== null) {
        const [countError, count] = await to(getMonthlyGymPlanCount(userId));
        if (countError) return createResponse(400, { message: 'Cannot retrieve information about generated plans' });
        monthlyCount = count ?? 0;
        if (monthlyCount >= monthlyCap) {
            return createResponse(400, { message: 'You have reached the limit of generated plans' });
        }
    } else {
        const [plansMetaError, results] = await to(
            Promise.all([getGeneralPlanLimit(), getGeneratedPlansNumber(userId)]),
        );
        if (plansMetaError) {
            return createResponse(400, { message: 'Cannot retrieve information about generated plans' });
        }
        const [generalPlanLimit, currentPlansNumber] = results ?? [0, -1];
        generatedPlansNumber = currentPlansNumber;
        if (currentPlansNumber === -1 || currentPlansNumber >= generalPlanLimit) {
            return createResponse(400, { message: 'You have reached the limit of generated plans' });
        }
    }

    // Add plan to the database
    const newPlan: NewPlan = {
        name: 'Plan ' + (monthlyCap !== null ? Date.now() : generatedPlansNumber),
        description: plan.description,
        workouts: JSON.parse(JSON.stringify(plan.workouts)),
        User: {
            connect: {
                id: userId,
            },
        },
    };

    const [addPlanError, savedPlan] = await to(addPlan(userId, newPlan));
    if (addPlanError) return createResponse(400, { message: 'Cannot save the  plan in the database' });

    // Both counters advance: generatedPlansNumber remains the lifetime stat (and the
    // number a canceled supporter falls back to); AiUsage tracks the monthly slot.
    const updatedPlansNumber = await updateGeneratedPlansNumber(userId);

    let plansLeft: number;
    if (monthlyCap !== null) {
        await incrementMonthlyGymPlanCount(userId);
        plansLeft = Math.max(0, monthlyCap - (monthlyCount + 1));
    } else {
        const generalPlanLimit = await getGeneralPlanLimit();
        plansLeft = typeof updatedPlansNumber === 'number' ? generalPlanLimit - updatedPlansNumber : 0;
    }

    const responseBody = {
        generatedPlan: savedPlan,
        plansLeft,
    };

    return createResponse(200, responseBody);
}
```

Note on plan naming: the FREE path keeps `'Plan ' + generatedPlansNumber`. The supporter path has no lifetime number loaded, so it uses a timestamp suffix — unique and cheap. (Names are user-editable already via `updatePlanName`.)

- [ ] **Step 5: Run to verify pass**

Run: `npx vitest run src/routes/api/plans/server.test.ts`
Expected: PASS — all 5 cases. (If the FREE happy-path assertion fails on `plansLeft`, check that `getGeneralPlanLimit` is called twice on the FREE path — pre-flight and post-save — both mocked to 10.)

- [ ] **Step 6: Supporter `plansLeft` in `updateUser`**

In `src/lib/utils/user.ts`, the session loader computes `plansLeft` for the UI. Make it tier-aware. After the tier is resolved (Phase 1 code), replace the `plansLeft` computation:

```ts
    const configuration = await db.configuration.findFirst({
        where: { name: 'generalPlanLimit' },
        select: { value: true },
    });
```

stays, and inside `if (user)` — after `const subscriptionTier = resolveTier({...})` — compute:

```ts
        let plansLeft = configuration && user ? +configuration.value - user.generatedPlansNumber : 0;
        if (subscriptionTier === 'SUPPORTER') {
            const monthKey = currentMonthStartIso();
            const usage = await db.aiUsage.findUnique({
                where: { userId_kind_day: { userId: user.id, kind: 'gym_plan', day: monthKey } },
                select: { count: true },
            });
            plansLeft = Math.max(0, (TIER_LIMITS.SUPPORTER.gymPlansPerMonth ?? 0) - (usage?.count ?? 0));
        }
```

Move the existing top-level `const plansLeft = ...` line into this block (it currently sits above `if (user)`), and add the imports:

```ts
import { TIER_LIMITS } from '@/constants/subscription.constants';
import { currentMonthStartIso } from '$lib/utils/iso-week';
```

(The `db.aiUsage` read runs only for supporters — one extra query per request for paying users; acceptable.)

- [ ] **Step 7: Type-check and full-suite sanity**

Run: `npm run check` — expected: only the 2 pre-existing `vite.config.ts` errors.
Run: `npx vitest run src/routes/api/plans src/lib` — expected: PASS.

- [ ] **Step 8: Commit**

```powershell
git add src/lib/prisma/prisma.ts src/routes/api/plans src/lib/utils/user.ts
git commit -m "feat(billing): monthly gym-plan cap for supporters (5/month)"
```

---

## Task 5: Weekly-report Markdown export (supporter-only)

**Files:**

- Create: `src/lib/server/reports/export-markdown.ts`
- Create: `src/lib/server/reports/export-markdown.test.ts`
- Create: `src/routes/api/user/[id]/reports/weekly/[reportId]/export/+server.ts`
- Create: `src/routes/api/user/[id]/reports/weekly/[reportId]/export/server.test.ts`
- Modify: `src/routes/app/running/analytics/reports/[id]/+page.svelte`

- [ ] **Step 1: Write the failing builder test**

Create `src/lib/server/reports/export-markdown.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildReportMarkdown } from './export-markdown';

const report = {
    periodStart: '2026-06-29',
    periodEnd: '2026-07-05',
    summary: '## Coach review\n\nSolid week.',
    createdAt: new Date('2026-07-06T10:00:00Z'),
    goalContext: {
        notes: 'Felt tired on Thursday',
        goals: [{ goalType: 'RACE', targetEventName: 'City Half', priority: 1 }],
    },
};

describe('buildReportMarkdown', () => {
    it('renders a titled document with period, goals, notes, and the summary', () => {
        const md = buildReportMarkdown(report);
        expect(md).toContain('# Weekly Training Report — 2026-06-29 to 2026-07-05');
        expect(md).toContain('RACE — City Half');
        expect(md).toContain('Felt tired on Thursday');
        expect(md).toContain('## Coach review');
        expect(md).toContain('Solid week.');
    });

    it('omits the goals and notes sections when absent', () => {
        const md = buildReportMarkdown({ ...report, goalContext: { notes: null, goals: [] } });
        expect(md).not.toContain('## Goals');
        expect(md).not.toContain('## Notes');
    });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/lib/server/reports/export-markdown.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the builder**

Create `src/lib/server/reports/export-markdown.ts`:

```ts
interface ExportGoal {
    goalType: string;
    targetEventName: string | null;
    priority: number;
}

export interface ExportableReport {
    periodStart: string;
    periodEnd: string;
    summary: string;
    createdAt: Date;
    goalContext: {
        notes: string | null;
        goals: ExportGoal[];
    };
}

export function buildReportMarkdown(report: ExportableReport): string {
    const lines: string[] = [
        `# Weekly Training Report — ${report.periodStart} to ${report.periodEnd}`,
        '',
        `_Generated ${report.createdAt.toISOString().slice(0, 10)} by GymCraft._`,
        '',
    ];

    if (report.goalContext.goals.length > 0) {
        lines.push('## Goals', '');
        for (const goal of report.goalContext.goals) {
            const name = goal.targetEventName ? ` — ${goal.targetEventName}` : '';
            lines.push(`- ${goal.goalType}${name} (priority ${goal.priority})`);
        }
        lines.push('');
    }

    if (report.goalContext.notes) {
        lines.push('## Notes', '', report.goalContext.notes, '');
    }

    lines.push(report.summary, '');
    return lines.join('\n');
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/lib/server/reports/export-markdown.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing endpoint test**

Create `src/routes/api/user/[id]/reports/weekly/[reportId]/export/server.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    getReportById: vi.fn(),
}));

vi.mock('$lib/prisma/prisma', () => ({
    getReportById: mocks.getReportById,
}));

import { GET } from './+server';

const params = { id: 'user-1', reportId: 'report-1' };

function makeLocals(tier: 'FREE' | 'SUPPORTER', userId = 'user-1') {
    return { user: { id: userId, subscriptionTier: tier } } as unknown as App.Locals;
}

const reportRow = {
    id: 'report-1',
    userId: 'user-1',
    periodStart: '2026-06-29',
    periodEnd: '2026-07-05',
    summary: 'Solid week.',
    createdAt: new Date('2026-07-06T10:00:00Z'),
    goalContext: { notes: null, goals: [] },
};

beforeEach(() => {
    mocks.getReportById.mockResolvedValue(reportRow);
});

afterEach(() => vi.clearAllMocks());

describe('GET .../reports/weekly/[reportId]/export', () => {
    it('rejects a mismatched user', async () => {
        const res = await GET({ params, locals: makeLocals('SUPPORTER', 'other') } as never);
        expect(res.status).toBe(403);
    });

    it('rejects FREE users with UPGRADE_REQUIRED', async () => {
        const res = await GET({ params, locals: makeLocals('FREE') } as never);
        expect(res.status).toBe(403);
        const json = await res.json();
        expect(json.code).toBe('UPGRADE_REQUIRED');
    });

    it('404s when the report does not exist', async () => {
        mocks.getReportById.mockResolvedValue(null);
        const res = await GET({ params, locals: makeLocals('SUPPORTER') } as never);
        expect(res.status).toBe(404);
    });

    it('returns a markdown attachment for supporters', async () => {
        const res = await GET({ params, locals: makeLocals('SUPPORTER') } as never);
        expect(res.status).toBe(200);
        expect(res.headers.get('Content-Type')).toContain('text/markdown');
        expect(res.headers.get('Content-Disposition')).toContain('weekly-report-2026-06-29.md');
        const body = await res.text();
        expect(body).toContain('# Weekly Training Report — 2026-06-29 to 2026-07-05');
        expect(body).toContain('Solid week.');
    });
});
```

- [ ] **Step 6: Run to verify failure**

Run: `npx vitest run "src/routes/api/user/[id]/reports/weekly/[reportId]/export/server.test.ts"`
Expected: FAIL — module not found.

- [ ] **Step 7: Implement the endpoint**

Create `src/routes/api/user/[id]/reports/weekly/[reportId]/export/+server.ts`:

```ts
import { createResponse } from '$lib/utils/response';
import { getReportById } from '$lib/prisma/prisma';
import { buildReportMarkdown, type ExportableReport } from '$lib/server/reports/export-markdown';

export async function GET({
    params,
    locals,
}: {
    params: { id: string; reportId: string };
    locals: App.Locals;
}): Promise<Response> {
    if (params.id !== locals.user?.id) {
        return createResponse(403, { message: 'Unauthorized' });
    }
    if (locals.user.subscriptionTier !== 'SUPPORTER') {
        return createResponse(403, {
            code: 'UPGRADE_REQUIRED',
            message: 'Report export is a Supporter feature',
        });
    }

    const report = await getReportById(params.reportId, params.id);
    if (!report) {
        return createResponse(404, { code: 'REPORT_NOT_FOUND', message: 'Report not found' });
    }

    const markdown = buildReportMarkdown(report as unknown as ExportableReport);

    return new Response(markdown, {
        status: 200,
        headers: {
            'Content-Type': 'text/markdown; charset=utf-8',
            'Content-Disposition': `attachment; filename="weekly-report-${report.periodStart}.md"`,
        },
    });
}
```

- [ ] **Step 8: Run to verify pass**

Run: `npx vitest run "src/routes/api/user/[id]/reports/weekly/[reportId]/export/server.test.ts"`
Expected: PASS — all 4 cases.

- [ ] **Step 9: Add the export button to the report page**

In `src/routes/app/running/analytics/reports/[id]/+page.svelte`:

1. Script additions (the page already imports from `@/constants/training-report.constants` and reads `$page`):

```ts
    import { getToastStore } from '@skeletonlabs/skeleton';
    import { makeToast } from '$lib/utils/toasts';
    import { DownloadIcon } from 'svelte-feather-icons';

    const toastStore = getToastStore();
    const user = $page.data.user;
    $: isSupporter = user.subscriptionTier === 'SUPPORTER';
    $: exportUrl = `/api/user/${user.id}/reports/weekly/${report.id}/export`;

    function exportBlocked() {
        makeToast(
            toastStore,
            'Report export is a Supporter feature — upgrade from your account page.',
            'variant-filled-warning',
        );
    }
```

2. In the header row (next to the "Generated …" timestamp, inside the existing `flex justify-between` div), add:

```svelte
        <div class="flex items-center gap-3">
            {#if isSupporter}
                <a href={exportUrl} download class="btn btn-sm variant-soft-primary" aria-label="Export report">
                    <DownloadIcon size="16" />
                    <span>Export .md</span>
                </a>
            {:else}
                <button
                    type="button"
                    class="btn btn-sm variant-soft-surface opacity-60"
                    on:click={exportBlocked}
                    aria-label="Export report (Supporter feature)">
                    <DownloadIcon size="16" />
                    <span>Export .md</span>
                </button>
            {/if}
            <p class="text-xs opacity-60">Generated {new Date(report.createdAt).toLocaleString('en-US')}</p>
        </div>
```

(Replace the existing bare `<p class="text-xs opacity-60">Generated …</p>` with this block.)

- [ ] **Step 10: Type-check + commit**

Run: `npm run check` — expected: only the 2 pre-existing `vite.config.ts` errors.

```powershell
git add src/lib/server/reports/export-markdown.ts src/lib/server/reports/export-markdown.test.ts "src/routes/api/user/[id]/reports/weekly/[reportId]" "src/routes/app/running/analytics/reports/[id]/+page.svelte"
git commit -m "feat(billing): supporter-only weekly report markdown export"
```

---

## Task 6: Supporter badge

**Files:**

- Create: `src/lib/components/billing/SupporterBadge.svelte`
- Modify: `src/routes/app/my-account/+page.svelte`

- [ ] **Step 1: Create the badge component**

Create `src/lib/components/billing/SupporterBadge.svelte`:

```svelte
<span class="chip variant-filled-secondary text-xs font-semibold uppercase tracking-wide" title="GymCraft Supporter">
    ★ Supporter
</span>
```

- [ ] **Step 2: Show it on the account page**

In `src/routes/app/my-account/+page.svelte`:

1. Import (next to the BillingPanel import from Phase 1):

```ts
    import SupporterBadge from '$lib/components/billing/SupporterBadge.svelte';
```

2. Change the name line:

```svelte
    <p>
        Name: <span class="text-secondary-400 font-bold">{user.name}</span>
        {#if user.subscriptionTier === 'SUPPORTER'}
            <SupporterBadge />
        {/if}
    </p>
```

- [ ] **Step 3: Lint + type-check**

Run: `npm run lint` and `npm run check` — expected: lint PASS; check shows only the 2 pre-existing `vite.config.ts` errors.

- [ ] **Step 4: Commit**

```powershell
git add src/lib/components/billing/SupporterBadge.svelte src/routes/app/my-account/+page.svelte
git commit -m "feat(billing): supporter badge on account page"
```

---

## Task 7: Full verification

**Files:** (none modified unless tidy-ups are needed)

- [ ] **Step 1: Full test suite**

Run: `npm run test`
Expected: PASS — no failures (Phase 1 baseline was 304 tests; Phase 2 adds ~15).

- [ ] **Step 2: Format, lint, typecheck**

Run: `npm run format-check` (only fix files this plan touched — 3 pre-existing unformatted files are out of scope), `npm run lint`, `npm run check` (2 pre-existing `vite.config.ts` errors are the accepted baseline).

- [ ] **Step 3: Manual smoke**

Run: `npm run dev`.

1. FREE user: `/app/my-account` shows no badge; a weekly report page shows the Export button that toasts an upgrade prompt; gym create-plan still enforces the lifetime cap.
2. Flip your test user to supporter in the DB (`UPDATE "User" SET "lifetimeSupporter" = true WHERE ...`), reload: badge appears, Export downloads a `.md`, plansLeft shows the monthly allowance.
3. Revert the flag when done.

- [ ] **Step 4: Final commit (only if tidy-ups were needed)**

```powershell
git status
# If clean, no commit needed.
```

---

## Notes for the executing engineer

- **`getLimit(tier, 'gymPlansPerMonth')` can return `null`** — that's the FREE sentinel meaning "lifetime cap applies". Don't coerce with `?? 0`.
- **The proxy `model` field is advisory until the Express proxy is updated.** The app sends it; the proxy ignores unknown body fields today. The `.ai/` spec updates are the contract for that follow-up work in `gym-craft-ai-proxy` (a separate repo — out of scope here).
- **Incremental syncs never use `backfillDays`** — the `0` passed by `runIncremental` to `persistActivities` is dead on that path (the fallback date only computes in the `backfill` branch).
- **Existing FREE users with >60d of history keep their old rows.** Shrinking the backfill window only affects future backfills (e.g. re-linking Garmin); nothing is deleted.
- **`updateUser` runs on every authenticated request.** The supporter-only `aiUsage` read adds one indexed query per request for supporters. If it ever shows up in traces, cache it alongside the existing node-cache patterns in `prisma.ts` — not now (YAGNI).
