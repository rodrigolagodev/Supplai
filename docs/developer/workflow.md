# Development Workflow

This guide outlines the development workflow, branching strategy, and coding standards for **Supplai**.

## Branching Strategy

We follow a simplified feature-branch workflow:

1.  **`main`**: The production-ready branch. All code here must be stable and deployable.
2.  **Feature Branches**: Created from `main` for new features, bug fixes, or refactoring.
    - Naming convention: `type/description`
    - Examples: `feat/voice-input`, `fix/login-error`, `refactor/auth-middleware`.

## Pull Request (PR) Process

1.  **Create a Branch**: `git checkout -b feat/my-feature`
2.  **Commit Changes**:
    - Use conventional commits (e.g., `feat: add voice recording component`).
    - Keep commits atomic and focused.
3.  **Push and Open PR**:
    - Push to origin: `git push origin feat/my-feature`
    - Open a PR against `main`.
4.  **Code Review**:
    - At least one approval is required.
    - CI checks (lint, test, build) must pass.
5.  **Merge**:
    - Squash and merge is preferred to keep the history clean.

## Coding Standards

### TypeScript

- Use strict mode (enabled by default in `tsconfig.json`).
- Avoid `any`; use specific types or `unknown` with narrowing.
- Define interfaces for component props and API responses.

### React / Next.js

- Use **Server Components** by default. Use `"use client"` only when necessary (state, effects, event listeners).
- Use `lucide-react` for icons.
- Use `tailwind-merge` and `clsx` for dynamic classes.

### Styling

- Use **Tailwind CSS** for all styling.
- Follow the project's design tokens (colors, spacing) defined in `globals.css` / `tailwind.config.ts`.
- Mobile-first approach.

## Tools & Scripts

- **Linting**: Run `pnpm lint` to check for issues.
- **Formatting**: Run `pnpm format` to format code with Prettier.
- **Testing**: Run `pnpm test` for unit tests and `pnpm test:e2e` for end-to-end tests.

## Pre-commit Hooks

Husky is configured to run linting and formatting checks on staged files before committing.
