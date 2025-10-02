# GymCraft Test Plan

**Version:** 2.0  
**Last updated:** 2025-01-20  
**Status:** Implementation Ready  
**Owner:** Development Team

## 1. Executive Summary

This comprehensive test plan outlines the testing strategy for GymCraft, a SvelteKit-based AI-powered workout plan generation application. The plan covers unit, integration, end-to-end, performance, security, and accessibility testing across the full stack.

### Key Testing Objectives

- Ensure reliable user authentication and authorization flows
- Validate AI-powered plan generation accuracy and performance
- Verify Garmin integration data synchronization
- Maintain high code quality and security standards
- Achieve comprehensive test coverage across all critical user journeys

## 2. Scope and Priorities

- **Frontend (SvelteKit, TS, Tailwind, Skeleton UI)**: pages in `src/routes`, shared components in `src/lib/components`, stores in `src/stores.ts`, client-side utilities in `src/lib/utils`.
    - Priorities: critical user journeys (onboarding, login/register, plan creation, viewing/saving plans, Garmin export), regression around form validation and navigation, accessibility.
- **Backend (SvelteKit server routes, Prisma ORM)**: server `+page.server.ts`/`+layout.server.ts` and `src/routes/api/**` endpoints, DB models/migrations in `prisma/**`, server utilities in `src/lib/server/**`.
    - Priorities: data integrity for plan generation and persistence, auth and email verification flows, rate/limit logic, OpenAI proxy usage, Garmin sync reliability.
- **Integrations**: OpenAI API (via proxy), Nodemailer/Mailgun, Garmin Connect microservice, Netlify platform (adapter + edge constraints), caching (`node-cache`), PDF export.
    - Priorities: timeout handling, retries/backoff, graceful degradation and user messaging, idempotency.
- **Non-functionals**: performance (TTFB, LCP, API latency), security (auth, PII handling), resilience (timeouts, network failures), accessibility.

### Risk Hotspots

- **OpenAI proxy dependency and Netlify function timeouts**: Critical for plan generation reliability
- **Email verification delivery (Mailgun) and token lifecycle**: Essential for user onboarding
- **Garmin sync path (external microservice + auth to Garmin)**: Complex integration with external service
- **Database migrations and schema evolution for plans/workouts**: Data integrity during schema changes
- **Caching correctness and staleness**: Performance vs. data consistency trade-offs

### Current State Assessment

- **Tooling present**: Vitest, Testing Library (Svelte), jsdom, vitest UI configured
- **Test coverage**: Minimal example test exists and is skipped
- **E2E setup**: Not yet implemented
- **CI/CD integration**: Basic scripts present, full pipeline needed
- **Test data management**: No factories or fixtures established

## 3. Testing Strategy and Types

- **Unit tests (high priority)**: components, stores, utilities, validation, server helpers.
- **Integration tests (high priority)**: SvelteKit load/actions, API routes with Prisma test DB, email verification flow, OpenAI call wrapper with mocked HTTP, Garmin mapping.
- **End-to-end tests (high priority for core flows)**: onboarding → register/login → create plan → view/save → export to Garmin; error paths. Recommended: Playwright.
- **Contract tests (medium)**: API response shapes for `/routes/api/**`, Prisma model invariants, mapping between domain and Garmin/OpenAI payloads.
- **Performance tests (medium)**: k6/Artillery for API latency and throughput; Lighthouse for web performance; bundle size checks.
- **Security tests (medium/high)**: auth/session, rate limiting behaviors, CSRF, input sanitization, secrets handling, email token abuse.
- **Accessibility tests (medium)**: axe checks and manual keyboard/screen-reader passes.

## 4. Critical Test Scenarios by Component

Frontend pages and flows

- `routes/(marketing)`: renders without SSR errors, SEO tags present via `Seo.svelte`, links to app routes work.
- Register/Login (`routes/app/register`, `routes/app/login`): form validation, error messages, successful submit navigates and sets session cookie.
- Email verification (`routes/(marketing)/verification-mail-sent`, `routes/app/verify`): token valid/invalid/expired, idempotent handling.
- Create Plan (`routes/app/create-plan`): multi-step form validation, state persistence, submit invokes backend, loading states, error banners, retry.
- My Plans (`routes/app/my-plans`): list rendering, pagination (if any), plan deletion confirmation, download as PDF.
- Garmin export: visible only when eligible, success/failure toasts, disabled state during in-flight.

Shared components

- `Survey/*` components: input change emits correct values, required fields validation, conditional questions logic.
- `DownloadAsPdf.svelte`: renders target content, triggers `html2pdf.js`, handles large content gracefully.
- `Navigation.svelte`: active link highlighting, auth-aware links, mobile menu accessibility.

Client utilities

- `utils/form-validation.ts`: all rules and edge cases covered.
- `utils/sanitize.ts`: protects against XSS, strips/encodes unsafe content.
- `utils/plan-description.ts`: deterministic text generation; snapshot where appropriate.
- `stores.ts`: default state, actions update state predictably.

Server/API

- `routes/api/user/*`: register (hash with bcrypt), login (bcrypt compare), logout, delete account (cascade plan removal), role/permission checks.
- `routes/api/plans/*`: create/read/delete with user scoping, plan limit enforcement, cascade behavior, workouts serialization.
- `routes/api/email-verification/*`: token creation, storage, expiry, single-use, error handling, rate limits.
- `routes/api/general-plan-limit/*`: limit values respected under concurrency.

Server utilities

- `lib/server/openai.ts`: prompt construction, payload compliance, retries/backoff on 429/5xx, timeout handling, proxy fallback.
- `lib/server/mail.ts`: Nodemailer/Mailgun transport config, sandbox mode, success/failure paths.
- `lib/prisma/prisma.ts` and `lib/database.ts`: singleton behavior, connection lifecycle, error handling.

Garmin integration

- `garmin/mapping.ts`: correct mapping for common and edge workouts, unit conversions, rejects invalid inputs.

Database layer

- Prisma models constraints: required fields, unique indices, cascades. Migrations apply cleanly; seed runs successfully.

Cross-cutting

- Auth/session: cookie flags, unauthorized access redirects, CSRF protections for actions.
- Caching: cache hit/miss logic, invalidation on mutations, TTL expiration.
- Error pages `+error.svelte`: user-friendly messaging, preserves navigation.

## 5. Technology-Specific Approaches and Tooling

- **Unit/Integration framework**: Vitest (already configured) with `jsdom` via `vitest-setup.js` and `@testing-library/svelte` for component testing.
- **API/Server integration**: Vitest in Node environment; spin up a Prisma test DB (SQLite or isolated Postgres schema). Use `supertest`-like calls through SvelteKit request handlers or invoke actions directly.
- **HTTP mocking**: `msw` for browser/node to mock OpenAI, Mailgun, Garmin endpoints. Alternatively `nock` for node-only tests.
- **E2E**: Playwright. Run SvelteKit dev server in CI and execute browser tests with tracing and video on failure.
- **Accessibility**: `@axe-core/playwright` or `jest-axe` with Testing Library.
- **Performance**: Playwright trace + Lighthouse CI for pages; `k6` or `Artillery` for API load.
- **Static analysis**: `svelte-check`, ESLint, TypeScript strictness; integrate into CI gate.

### Required Package Additions

```bash
# E2E Testing
npm install -D @playwright/test

# HTTP Mocking
npm install -D msw nock

# Accessibility Testing
npm install -D @axe-core/playwright jest-axe

# Performance Testing
npm install -D k6 artillery lighthouse-ci

# Test Utilities
npm install -D @faker-js/faker supertest dotenv-cli
npm install -D prisma-test-utils

# Coverage and Reporting
npm install -D c8 @vitest/coverage-v8
```

### Configuration Files Needed

- `playwright.config.ts` - E2E test configuration
- `vitest.config.ts` - Enhanced unit/integration test config
- `k6/` directory - Performance test scripts
- `.env.test` - Test environment variables
- `tests/fixtures/` - Test data and mock responses

## 6. Test Environment Requirements and Setup

- **Node**: v18+ (match production), npm 10+.
- **Databases**: ephemeral Postgres schema per CI job or SQLite for fast integration tests; seed scripts for baseline data.
- **Secrets**: use `.env.test` with test keys; Mailgun sandbox domain; fake OpenAI key; disable real sends by default.
- **SvelteKit**: start on random port for e2e; adapter-auto for local tests.
- **Browsers**: Playwright-managed Chromium/Firefox/WebKit in CI; headed locally when debugging.
- **CI**: GitHub Actions workflow to run lint → typecheck → unit/integration → e2e → build.

## 7. Test Data Management and Mocking Strategies

- **Factories/Fixtures**: build factory helpers for users, plans, workouts; deterministic IDs/timestamps for snapshot stability.
- **Prisma**: wrap tests in transactions; rollback per test/suite. Use `prisma migrate deploy` for CI and `prisma db push` for local rapid iterations.
- **External services**:
    - OpenAI: `msw`/`nock` with realistic JSON fixtures; include 429/timeout responses to test retries.
    - Mailgun/Nodemailer: use `nodemailer` stub transport or Mailgun sandbox; assert on generated payload.
    - Garmin: mock microservice endpoints and schema; include auth failures and 500s.
- **Time and randomness**: freeze time in tests; seed RNG to ensure deterministic outputs from helpers.
- **Files/PDF**: use small HTML fixtures; stub `html2pdf.js` in unit tests, run real conversion in one integration test.

## 8. Performance Testing Strategy

- **API**: baseline latency and P95/P99 for plan creation and list queries under realistic load; check Prisma query plans and indexes.
- **Frontend**: Lighthouse budgets for LCP (<2.5s), CLS (<0.1), JS bundle size; verify Tailwind purge effectiveness and code-splitting.
- **Resilience**: chaos tests for timeouts on OpenAI/Garmin; ensure user-facing fallbacks and retries.
- **Caching**: measure hit ratio and TTL efficacy for read endpoints.

## 9. Security Testing Framework

- **Authentication/Authorization**: brute-force protection checks, bcrypt cost factor sanity, route guards on `app/**` and `api/**` user scoping.
- **Input handling**: server-side validation for forms, sanitization checks against XSS; verify `sanitize.ts` usage where required.
- **Sessions/Cookies**: `HttpOnly`, `Secure`, `SameSite` flags; CSRF protections on form actions; logout invalidation.
- **Secrets**: environment variable handling via `environment.ts`; ensure no secrets in client bundles; CI secret scanning.
- **Data protection**: Prisma schema constraints, cascade delete correctness; verify least-privilege for DB user in prod.
- **Headers**: set security headers via SvelteKit hooks or Netlify configuration (CSP, HSTS where applicable).

## 10. Test Coverage and Reporting Strategy

- **Targets**: 80%+ statements/branches on utils and stores; 70%+ on components; critical server routes 80%+.
- **Reports**: enable Vitest coverage with `--coverage` and publish artifacts in CI; diff-based coverage gating for PRs.

## 11. CI/CD Integration and Execution Plan

- Local: `npm run lint`, `npm run check`, `npm run test` for unit/integration; `playwright test` for e2e.
- CI (GitHub Actions): matrix on Node LTS; services for Postgres if used; cache npm and Playwright browsers; upload traces/videos on failure; deploy previews on Netlify after green checks.

## 12. Implementation Roadmap

1. Add Playwright e2e scaffold and a smoke test for home page.
2. Introduce `msw` and global test server for HTTP mocks.
3. Add Prisma test DB setup with transaction-per-test helper.
4. Write unit tests for `utils/*` and key components (`Survey/*`, `DownloadAsPdf.svelte`).
5. Integration tests for auth, plan CRUD, email verification flow.
6. Contract tests for Garmin mapping and OpenAI payload builder.
7. Add Lighthouse CI and simple k6 script for `/api/plans`.
8. Add security checks (dependency audit, headers, CSRF tests).

## 13. Test Traceability Matrix

- User Registration → API user create, bcrypt, email token → unit + integration + e2e
- Email Verification → token validate, Mailgun send, page flow → integration + e2e
- Login/Logout → session cookie, guards, redirects → integration + e2e
- Create Plan → validation, OpenAI proxy, DB persist → integration + e2e
- View Plans → list, pagination, delete cascade → unit + integration + e2e
- Export to Garmin → mapping, HTTP to microservice, feedback → integration + e2e

## 14. Test Naming Conventions and Patterns

### Unit Test Naming

```typescript
// Pattern: describe('ComponentName', () => { it('should behavior when condition') })
describe('validateRegisterFormData', () => {
    it('should return null for valid input');
    it('should return error for invalid email format');
    it('should reject passwords shorter than 8 characters');
});

describe('UserStore', () => {
    it('should initialize with null user');
    it('should update user state on login');
    it('should clear user state on logout');
});
```

### Integration Test Naming

```typescript
// Pattern: describe('HTTP_METHOD /api/endpoint', () => { it('should behavior') })
describe('POST /api/user/register', () => {
    it('should create user with valid data');
    it('should reject duplicate email addresses');
    it('should hash password before storage');
});

describe('GET /api/plans', () => {
    it('should return user plans when authenticated');
    it('should return 401 when not authenticated');
    it('should respect pagination parameters');
});
```

### E2E Test Naming

```typescript
// Pattern: describe('User Journey: Action', () => { it('should complete flow') })
describe('User Journey: Registration and Plan Creation', () => {
    it('should complete full registration flow');
    it('should create workout plan after registration');
    it('should handle email verification');
});
```

## 15. Test Configuration Examples

### Vitest Configuration (vitest.config.ts)

```typescript
import { defineConfig } from 'vitest/config';
import { sveltekit } from '@sveltejs/kit/vite';
import path from 'path';

export default defineConfig({
    plugins: [sveltekit()],
    test: {
        setupFiles: ['./vitest-setup.js'],
        include: ['src/**/*.{test,spec}.{js,ts}'],
        exclude: ['node_modules', 'build', 'dist'],
        environment: 'jsdom',
        coverage: {
            provider: 'v8',
            reporter: ['text', 'html', 'json', 'lcov'],
            reportsDirectory: './coverage',
            include: ['src/**/*.{js,ts,svelte}'],
            exclude: ['src/**/*.d.ts', 'src/**/*.config.{js,ts}', 'src/**/*.test.{js,ts}', 'src/**/*.spec.{js,ts}'],
            threshold: {
                global: {
                    branches: 80,
                    functions: 80,
                    lines: 80,
                    statements: 80,
                },
            },
        },
        testTimeout: 10000,
        hookTimeout: 10000,
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
            '@components': path.resolve(__dirname, './src/lib/components'),
            '@utils': path.resolve(__dirname, './src/lib/utils'),
        },
    },
});
```

### Playwright Configuration (playwright.config.ts)

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
    testDir: './tests/e2e',
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 1 : undefined,
    reporter: [['html'], ['json', { outputFile: 'test-results/results.json' }]],
    use: {
        baseURL: 'http://localhost:4173',
        trace: 'on-first-retry',
        video: 'retain-on-failure',
        screenshot: 'only-on-failure',
    },
    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
        {
            name: 'firefox',
            use: { ...devices['Desktop Firefox'] },
        },
        {
            name: 'webkit',
            use: { ...devices['Desktop Safari'] },
        },
        {
            name: 'Mobile Chrome',
            use: { ...devices['Pixel 5'] },
        },
    ],
    webServer: {
        command: 'npm run build && npm run preview',
        url: 'http://localhost:4173',
        reuseExistingServer: !process.env.CI,
    },
});
```

## 16. Test Data Factories and Fixtures

### User Factory (tests/factories/user.factory.ts)

```typescript
import { faker } from '@faker-js/faker';
import type { User } from '@prisma/client';

export const createUserFactory = (overrides: Partial<User> = {}): Omit<User, 'id' | 'createdAt' | 'updatedAt'> => ({
    email: faker.internet.email(),
    username: faker.internet.userName(),
    password: faker.internet.password({ length: 12 }),
    isEmailVerified: false,
    roleId: 1,
    marketingAgreement: false,
    ...overrides,
});

export const createVerifiedUser = (overrides: Partial<User> = {}) =>
    createUserFactory({ isEmailVerified: true, ...overrides });
```

### Plan Factory (tests/factories/plan.factory.ts)

```typescript
import { faker } from '@faker-js/faker';
import type { Plan } from '@prisma/client';

export const createPlanFactory = (overrides: Partial<Plan> = {}): Omit<Plan, 'id' | 'createdAt' | 'updatedAt'> => ({
    userId: faker.string.uuid(),
    title: faker.lorem.words(3),
    description: faker.lorem.paragraph(),
    generatedPlan: JSON.stringify({
        workouts: [
            {
                name: 'Push Day',
                exercises: [{ name: 'Bench Press', sets: 3, reps: 8, weight: '135 lbs' }],
            },
        ],
    }),
    ...overrides,
});
```

### Mock API Responses (tests/fixtures/api-responses.ts)

```typescript
export const mockOpenAIResponse = {
    choices: [
        {
            message: {
                content: JSON.stringify({
                    workouts: [
                        {
                            name: 'Upper Body Strength',
                            exercises: [
                                { name: 'Bench Press', sets: 3, reps: 8, weight: '135 lbs' },
                                { name: 'Pull-ups', sets: 3, reps: 10, weight: 'Bodyweight' },
                            ],
                        },
                    ],
                }),
            },
        },
    ],
};

export const mockGarminAuthResponse = {
    access_token: 'mock_access_token',
    token_type: 'Bearer',
    expires_in: 3600,
};
```

## 17. Accessibility Testing Framework

### Automated Accessibility Tests

```typescript
// tests/accessibility/a11y.test.ts
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Accessibility Tests', () => {
    test('should not have accessibility violations on home page', async ({ page }) => {
        await page.goto('/');

        const accessibilityScanResults = await new AxeBuilder({ page }).analyze();

        expect(accessibilityScanResults.violations).toEqual([]);
    });

    test('should be keyboard navigable', async ({ page }) => {
        await page.goto('/app/create-plan');

        // Test tab navigation
        await page.keyboard.press('Tab');
        await expect(page.locator(':focus')).toBeVisible();

        // Test form submission with Enter
        await page.fill('[name="email"]', 'test@example.com');
        await page.keyboard.press('Enter');
    });
});
```

### Manual Accessibility Checklist

- [ ] All interactive elements are keyboard accessible
- [ ] Color contrast meets WCAG AA standards (4.5:1 ratio)
- [ ] Images have appropriate alt text
- [ ] Form labels are properly associated
- [ ] Focus indicators are visible
- [ ] Screen reader compatibility verified
- [ ] Mobile accessibility tested

## 18. Performance Testing Scripts

### K6 Load Test (k6/plan-creation.js)

```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';

export let options = {
    stages: [
        { duration: '2m', target: 10 }, // Ramp up
        { duration: '5m', target: 10 }, // Stay at 10 users
        { duration: '2m', target: 0 }, // Ramp down
    ],
    thresholds: {
        http_req_duration: ['p(95)<500'], // 95% of requests under 500ms
        http_req_failed: ['rate<0.1'], // Error rate under 10%
    },
};

export default function () {
    const payload = JSON.stringify({
        email: 'test@example.com',
        username: 'testuser',
        password: 'testpassword123',
    });

    const params = {
        headers: { 'Content-Type': 'application/json' },
    };

    const response = http.post('http://localhost:3000/api/user/register', payload, params);

    check(response, {
        'status is 201': (r) => r.status === 201,
        'response time < 500ms': (r) => r.timings.duration < 500,
    });

    sleep(1);
}
```

### Lighthouse CI Configuration (.lighthouserc.js)

```javascript
module.exports = {
    ci: {
        collect: {
            url: ['http://localhost:4173/', 'http://localhost:4173/app/create-plan'],
            startServerCommand: 'npm run preview',
        },
        assert: {
            assertions: {
                'categories:performance': ['error', { minScore: 0.9 }],
                'categories:accessibility': ['error', { minScore: 0.9 }],
                'categories:best-practices': ['error', { minScore: 0.9 }],
                'categories:seo': ['error', { minScore: 0.9 }],
            },
        },
        upload: {
            target: 'temporary-public-storage',
        },
    },
};
```

## 19. Security Testing Implementation

### Security Test Suite (tests/security/security.test.ts)

```typescript
import { test, expect } from '@playwright/test';

test.describe('Security Tests', () => {
    test('should prevent SQL injection in user registration', async ({ page }) => {
        await page.goto('/app/register');

        await page.fill('[name="email"]', "'; DROP TABLE users; --");
        await page.fill('[name="username"]', 'testuser');
        await page.fill('[name="password"]', 'testpassword123');
        await page.click('button[type="submit"]');

        // Should not cause database error
        await expect(page.locator('.error')).not.toContainText('SQL');
    });

    test('should prevent XSS in plan creation', async ({ page }) => {
        await page.goto('/app/create-plan');

        const maliciousScript = '<script>alert("XSS")</script>';
        await page.fill('[name="title"]', maliciousScript);

        // Should sanitize input
        const titleValue = await page.inputValue('[name="title"]');
        expect(titleValue).not.toContain('<script>');
    });

    test('should enforce CSRF protection', async ({ page }) => {
        const response = await page.request.post('/api/plans', {
            data: { title: 'Test Plan' },
        });

        // Should require CSRF token
        expect(response.status()).toBe(403);
    });
});
```

## 20. Monitoring and Alerting Strategy

### Test Metrics Dashboard

- **Test Execution Time**: Track test suite duration trends
- **Flaky Test Rate**: Monitor and reduce unstable tests
- **Coverage Trends**: Ensure coverage doesn't decrease
- **Performance Regression**: Alert on performance degradation
- **Security Scan Results**: Monitor vulnerability detection

### Alerting Rules

```yaml
# .github/workflows/test-alerts.yml
name: Test Alerts
on:
    schedule:
        - cron: '0 9 * * 1-5' # Weekdays at 9 AM

jobs:
    test-health-check:
        runs-on: ubuntu-latest
        steps:
            - name: Check test metrics
              run: |
                  # Check for flaky tests
                  if [ "$FLAKY_TEST_RATE" -gt 5 ]; then
                    echo "Alert: High flaky test rate detected"
                  fi

                  # Check coverage regression
                  if [ "$COVERAGE_DECREASE" -gt 2 ]; then
                    echo "Alert: Coverage decreased significantly"
                  fi
```

## 21. Test Maintenance and Cleanup

### Regular Maintenance Tasks

- **Weekly**: Review and update test data fixtures
- **Bi-weekly**: Audit and remove obsolete tests
- **Monthly**: Update dependencies and security patches
- **Quarterly**: Review and optimize test performance

### Test Cleanup Checklist

- [ ] Remove tests for deprecated features
- [ ] Update test data to match current schema
- [ ] Consolidate duplicate test cases
- [ ] Optimize slow-running tests
- [ ] Update documentation for changed tests

## 22. Success Metrics and KPIs

### Quality Metrics

- **Test Coverage**: Maintain >80% code coverage
- **Test Stability**: <5% flaky test rate
- **Bug Detection**: >90% of production bugs caught by tests
- **Performance**: Test suite runs in <10 minutes

### Business Impact Metrics

- **Deployment Confidence**: 100% of deployments with passing tests
- **Time to Market**: Reduced by 30% through automated testing
- **Customer Satisfaction**: <2% of issues related to untested features
- **Development Velocity**: 25% faster feature development

## 23. Appendices

### A. Test Environment Variables

```bash
# .env.test
DATABASE_URL="postgresql://test:test@localhost:5432/gymcraft_test"
OPENAI_API_KEY="test_key_12345"
MAILGUN_API_KEY="test_mailgun_key"
GARMIN_CLIENT_ID="test_garmin_id"
NODE_ENV="test"
```

### B. Database Test Setup

```typescript
// tests/setup/database.ts
import { PrismaClient } from '@prisma/client';

export const testDb = new PrismaClient({
    datasources: {
        db: {
            url: process.env.DATABASE_URL,
        },
    },
});

export const setupTestDb = async () => {
    await testDb.$connect();
    await testDb.$executeRaw`TRUNCATE TABLE "User", "Plan", "VerificationToken" CASCADE`;
};

export const teardownTestDb = async () => {
    await testDb.$disconnect();
};
```

### C. Mock Service Worker Setup

```typescript
// tests/mocks/handlers.ts
import { rest } from 'msw';

export const handlers = [
    rest.post('https://api.openai.com/v1/chat/completions', (req, res, ctx) => {
        return res(ctx.status(200), ctx.json(mockOpenAIResponse));
    }),

    rest.post('https://api.mailgun.net/v3/*/messages', (req, res, ctx) => {
        return res(ctx.status(200), ctx.json({ id: 'mock_message_id' }));
    }),
];
```

This comprehensive test plan provides a complete framework for implementing robust testing across the GymCraft application, with specific configurations, examples, and implementation guidance.
