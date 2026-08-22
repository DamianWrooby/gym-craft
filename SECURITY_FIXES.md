# Security Fixes Summary

**Date:** 2026-04-04
**Branch:** `feat/security-audit`
**Based on:** SECURITY_AUDIT.md (36 findings)

---

## Phase 1: Authorization & CSRF (Critical - C1, C2)

### IDOR Fix - All API endpoints now use `locals.user`

| File                                                     | Change                                                                  |
| -------------------------------------------------------- | ----------------------------------------------------------------------- |
| `src/lib/server/auth.ts`                                 | **New file** - `getAuthenticatedUser()` and `assertOwnership()` helpers |
| `src/routes/api/plans/[id]/+server.ts`                   | Uses `locals.user.id` instead of `body.userId` for POST and DELETE      |
| `src/routes/api/plans/+server.ts`                        | Uses `locals.user` instead of reading session from body                 |
| `src/routes/api/user/[id]/plans/+server.ts`              | Verifies `params.id === locals.user.id`                                 |
| `src/routes/api/user/[id]/garmin/check-email/+server.ts` | Verifies `params.id === locals.user.id`                                 |
| `src/routes/api/user/[id]/garmin/save-email/+server.ts`  | Verifies `params.id === locals.user.id`                                 |
| `src/routes/api/user/+server.ts`                         | Uses `locals.user.id` instead of `body.userId`                          |
| `src/routes/api/email-verification/[userId]/+server.ts`  | Verifies `params.userId === locals.user.id`                             |

### Client-side changes (stopped sending userId in bodies)

- `src/routes/app/my-plans/+page.svelte` - Removed `userId` from rename and delete request bodies
- `src/routes/app/my-account/+page.svelte` - Removed `userId` from delete account request body

### CSRF Protection

- `svelte.config.js` - Added `csrf: { checkOrigin: true }`

### Prisma ownership check

- `src/lib/prisma/prisma.ts` - `updatePlanName()` now uses `where: { id: planId, userId }` compound check

---

## Phase 2: Session Security (Critical - C3, High - H2, H3)

### Session token removed from client

- `src/lib/utils/user.ts` - Removed `session` from `locals.user` object
- `src/models/user/user.model.ts` - Removed `session` field from User interface
- `src/routes/app/create-plan/+page.svelte` - Removed `session` from both proxy and plans API request bodies

### Session invalidation on logout

- `src/routes/app/logout/+page.server.ts` - Now sets `userAuthToken` to empty string in DB before clearing cookie; cookie clearing includes all flags (`httpOnly`, `sameSite`, `secure`)

### Session tokens hashed with SHA-256

- `src/routes/app/login/+page.server.ts` - Hashes token before storing in DB, sends raw token in cookie
- `src/routes/app/register/+page.server.ts` - Hashes token before storing in DB
- `src/lib/utils/user.ts` - Hashes cookie value before DB lookup
- `src/routes/app/logout/+page.server.ts` - Hashes cookie value before DB invalidation

---

## Phase 3: XSS Prevention (High - H5, H6)

### HTML escaping in plan descriptions

- `src/lib/utils/plan-description.ts` - Added `escapeHtml()` utility; applied to all user-controlled values: `plan.name`, `plan.description`, `workout.workoutName`, `workout.justification`, `step.description`, exercise names, end condition values, target values

### Modal XSS fix

- `src/routes/app/my-plans/+page.svelte` - Added `escapeHtml()` function; `plan.name` is escaped before interpolation in delete confirmation modal body

---

## Phase 4: Auth Hardening (High - H4, H7, H8, H9, H11)

### Bcrypt cost increase

- `src/routes/app/register/+page.server.ts` - Cost factor changed from 10 to 12

### User enumeration fix

- `src/routes/app/register/+page.server.ts` - Both username and email conflicts now return generic `{ accountExists: true }` instead of separate `userExists`/`emailExists` errors
- `src/routes/app/register/+page.svelte` - Updated error message to "The username or email may already be in use."

### Email uniqueness enforced everywhere

- `src/routes/app/register/+page.server.ts` - Removed `isProduction()` guard around email uniqueness check

### Error message leakage fixed

- `src/routes/api/plans/[id]/+server.ts` - Returns generic "Database error" instead of raw `(error as Error).message`
- `src/routes/api/user/+server.ts` - Removed `console.error(deleteError)`

### Console.log cleanup

- `src/lib/server/mail.ts` - Removed `console.log('Error in sendVerificationToken:', err)`, `console.error('Mail provider error:', err)`, `console.log('Email sent successfully')`
- `src/lib/prisma/prisma.ts` - Removed `console.log('User verified successfully')`
- `src/routes/app/verify/[userId]/[token]/+page.server.ts` - Removed `console.log(err)`
- `src/routes/app/+page.server.ts` - Removed `console.log(env: ${PUBLIC_APP_ENV})`

### Client-side cookie utility hardened

- `src/lib/utils/cookies.ts` - Added `SameSite=Strict` flag
- `src/routes/app/my-account/+page.svelte` - Removed `setCookie('session', '', 0)` call (httpOnly cookies can't be cleared client-side anyway)

---

## Phase 5: Security Headers & Config (Medium - M0, M3, M4, M5, M9, M10)

### Security response headers

- `src/hooks.server.ts` - Added `addSecurityHeaders()` function that sets:
    - `X-Frame-Options: DENY`
    - `X-Content-Type-Options: nosniff`
    - `Referrer-Policy: strict-origin-when-cross-origin`
    - `Strict-Transport-Security: max-age=31536000; includeSubDomains`
    - `Permissions-Policy: camera=(), microphone=(), geolocation=()`

### Public path matching fix

- `src/hooks.server.ts` - Changed from `startsWith` prefix matching to `Set` for exact matches + explicit `/app/verify/` prefix

### Dev-mode bypass fix

- `src/lib/components/survey/SurveyForm.svelte` - Changed `PUBLIC_APP_ENV === 'development'` to `import.meta.env.DEV` (tree-shaken in production builds)

---

## Phase 6: Dependency Updates

- Ran `npm audit fix` - reduced from 43 to 32 vulnerabilities
- Remaining 32 vulnerabilities require breaking major version upgrades of: `@sveltejs/kit`, `svelte`, `bcrypt`, `nodemailer`, `html2pdf.js`

---

## Tests Updated

| Test File                              | Changes                                                                                                                                   |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `src/routes/app/login/page.test.ts`    | Updated to verify SHA-256 hashed session token in DB                                                                                      |
| `src/routes/app/register/page.test.ts` | Updated snapshots for `accountExists` error, fixed `termsOfUse` test data (`'on'` instead of `'true'`), updated hashed token expectations |
| `src/routes/app/logout/page.test.ts`   | Added DB mock for session invalidation, crypto mock for hashing, updated cookie flag expectations                                         |

**All 20 tests passing. Lint clean. Formatting fixed.**

---

## Remaining Items (Backlog)

| ID  | Finding                                 | Reason Deferred                                                     |
| --- | --------------------------------------- | ------------------------------------------------------------------- |
| H1  | Rate limiting on auth endpoints         | Requires infrastructure decision (middleware vs external service)   |
| L1  | Session token entropy (UUID vs 256-bit) | Current UUID provides 122 bits - acceptable                         |
| L4  | 30-day session expiry                   | Requires UX decision on session length                              |
| L5  | Audit logging                           | Requires logging infrastructure setup                               |
| L6  | Password breach check (HaveIBeenPwned)  | External API dependency                                             |
| L7  | Serverless DB connection management     | Requires Prisma serverless adapter evaluation                       |
| M3  | Content Security Policy (CSP)           | Requires careful tuning with GA and inline styles                   |
| M8  | Google Analytics SRI                    | Requires CSP implementation first                                   |
| C4  | Breaking dependency upgrades            | Requires dedicated migration effort for SvelteKit 2, Svelte 5, etc. |
