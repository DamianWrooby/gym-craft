# AI Rules for GymCraft

Web application for generating AI-powered personalized workout plans tailored to your goals, experience, and physical condition

## CODING_PRACTICES

### Guidelines for SUPPORT_LEVEL

#### SUPPORT_EXPERT

- Favor elegant, maintainable solutions over verbose code. Assume understanding of language idioms and design patterns.
- Highlight potential performance implications and optimization opportunities in suggested code.
- Frame solutions within broader architectural contexts and suggest design alternatives when appropriate.
- Focus comments on 'why' not 'what' - assume code readability through well-named functions and variables.
- Proactively address edge cases, race conditions, and security considerations without being prompted.
- When debugging, provide targeted diagnostic approaches rather than shotgun solutions.
- Suggest comprehensive testing strategies rather than just example tests, including considerations for mocking, test organization, and coverage.

## FRONTEND

### Guidelines for SVELTE

#### SVELTE_KIT

- Use server-side load functions to fetch data before rendering pages
- Implement form actions for handling form submissions with progressive enhancement
- Use page stores ($page) to access route parameters and other page data
- Leverage SvelteKit's server-only modules for sensitive operations
- Implement +error.svelte files for custom error handling at the route level
- Use the enhance function for progressive enhancement of forms
- Leverage SvelteKit hooks for global middleware functionality
- Implement route groups (folders with parentheses) for logical organization without URL impact
- Use the new Embedded SvelteKit plugin system
- Implement content negotiation with accept header in load functions

#### SVELTE_CODING_STANDARDS

- Use the $ prefix for reactive store values instead of manual store subscription
- Use slot props for better component composition
- Leverage the :global() modifier sparingly for global CSS
- Implement Svelte transitions and animations for smooth UI changes
- Use simple callback props instead of createEventDispatcher
- Use lifecycle functions (onMount, onDestroy) for setup and cleanup
- Leverage special elements like <svelte:window> and <svelte:component> for dynamic behavior

## TESTING

### Guidelines for UNIT

#### VITEST

- Leverage the `vi` object for test doubles - Use `vi.fn()` for function mocks, `vi.spyOn()` to monitor existing functions, and `vi.stubGlobal()` for global mocks. Prefer spies over mocks when you only need to verify interactions without changing behavior.
- Master `vi.mock()` factory patterns - Place mock factory functions at the top level of your test file, return typed mock implementations, and use `mockImplementation()` or `mockReturnValue()` for dynamic control during tests. Remember the factory runs before imports are processed.
- Create setup files for reusable configuration - Define global mocks, custom matchers, and environment setup in dedicated files referenced in your `vitest.config.ts`. This keeps your test files clean while ensuring consistent test environments.
- Use inline snapshots for readable assertions - Replace complex equality checks with `expect(value).toMatchInlineSnapshot()` to capture expected output directly in your test file, making changes more visible in code reviews.
- Monitor coverage with purpose and only when asked - Configure coverage thresholds in `vitest.config.ts` to ensure critical code paths are tested, but focus on meaningful tests rather than arbitrary coverage percentages.
- Make watch mode part of your workflow - Run `vitest --watch` during development for instant feedback as you modify code, filtering tests with `-t` to focus on specific areas under development.
- Explore UI mode for complex test suites - Use `vitest --ui` to visually navigate large test suites, inspect test results, and debug failures more efficiently during development.
- Handle optional dependencies with smart mocking - Use conditional mocking to test code with optional dependencies by implementing `vi.mock()` with the factory pattern for modules that might not be available in all environments.
- Configure jsdom for DOM testing - Set `environment: 'jsdom'` in your configuration for frontend component tests and combine with testing-library utilities for realistic user interaction simulation.
- Structure tests for maintainability - Group related tests with descriptive `describe` blocks, use explicit assertion messages, and follow the Arrange-Act-Assert pattern to make tests self-documenting.
- Leverage TypeScript type checking in tests - Enable strict typing in your tests to catch type errors early, use `expectTypeOf()` for type-level assertions, and ensure mocks preserve the original type signatures.
