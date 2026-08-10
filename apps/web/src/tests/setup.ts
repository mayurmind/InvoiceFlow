/**
 * Vitest global setup for apps/web.
 *
 * This file runs before every test suite regardless of environment.
 * Environment-specific setup is handled via environmentMatchGlobs in vitest.config.ts.
 */

// @testing-library/jest-dom matchers are only useful in jsdom.
// They are imported at the top of component test files that need them,
// not globally, to avoid node-environment import errors.
