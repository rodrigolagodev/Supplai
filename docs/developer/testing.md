# Testing Strategy

**Supplai** uses a combination of unit, integration, and end-to-end (E2E) testing to ensure application reliability.

## Testing Stack

- **Unit & Integration**: [Vitest](https://vitest.dev/)
  - Fast, Vite-native testing framework.
  - Used for testing utility functions, hooks, and individual components.
- **End-to-End (E2E)**: [Playwright](https://playwright.dev/)
  - Reliable browser automation.
  - Used for testing critical user flows (login, order creation).
- **DOM Testing**: `@testing-library/react`

## Running Tests

### Unit Tests

Run all unit tests:

```bash
pnpm test
```

Run tests with coverage:

```bash
pnpm test:coverage
```

### E2E Tests

Run E2E tests (headless):

```bash
pnpm test:e2e
```

Run E2E tests with UI (interactive mode):

```bash
pnpm test:e2e:ui
```

## Writing Tests

### Unit Tests (`*.test.ts`, `*.test.tsx`)

Place unit tests alongside the file they test or in a `__tests__` directory.

Example `src/lib/utils.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { cn } from './utils';

describe('cn utility', () => {
  it('merges class names correctly', () => {
    expect(cn('p-4', 'bg-red-500')).toBe('p-4 bg-red-500');
  });
});
```

### E2E Tests (`e2e/*.spec.ts`)

Place E2E tests in the `e2e` directory.

Example `e2e/home.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';

test('homepage has title', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Supplai/);
});
```

## CI/CD Integration

Tests are automatically run in the CI pipeline on every Pull Request. Ensure all tests pass before merging.
