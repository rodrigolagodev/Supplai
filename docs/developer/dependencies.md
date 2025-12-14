# Dependencies & Versioning

This document lists the key dependencies and their versions used in **Supplai**, derived from `package.json`.

## Core Frameworks

- **Runtime**: Node.js (via `pnpm`)
- **Framework**: [Next.js](https://nextjs.org/) `16.0.7`
- **Language**: [TypeScript](https://www.typescriptlang.org/) `5.9.3`
- **Package Manager**: `pnpm@10.22.0`

## UI & Styling

- **Styling Engine**: [Tailwind CSS](https://tailwindcss.com/) `4.1.17`
- **Component Primitives**: [Radix UI](https://www.radix-ui.com/)
  - Dialog, Popover, Select, Slot, Tooltip, Avatar, Alert Dialog
- **Icons**: [Lucide React](https://lucide.dev/) `0.554.0`
- **Animations**: [Framer Motion](https://www.framer.com/motion/) `12.23.24`
- **Utility**: `clsx`, `tailwind-merge`, `class-variance-authority`

## Backend & Database

- **BaaS**: [Supabase](https://supabase.com/)
  - Client: `@supabase/supabase-js` `2.83.0`
  - SSR: `@supabase/ssr` `0.7.0`
- **ORM/Query Builder**: Supabase Client (PostgREST)
- **Local Database**: [Dexie.js](https://dexie.org/) `4.2.1` (IndexedDB wrapper)

## AI & Processing

- **SDK**: [Vercel AI SDK](https://sdk.vercel.ai/docs) `5.0.101`
  - `@ai-sdk/google`: `2.0.42`
  - `@ai-sdk/react`: `2.0.101`
- **Models**:
  - Google Generative AI: `@google/generative-ai` `0.24.1`
  - Groq SDK: `groq-sdk` `0.36.0`

## Forms & Validation

- **Forms**: [React Hook Form](https://react-hook-form.com/) `7.66.1`
- **Validation**: [Zod](https://zod.dev/) `4.1.12`
- **Resolvers**: `@hookform/resolvers` `5.2.2`

## Utilities

- **Date Handling**: [date-fns](https://date-fns.org/) `4.1.0`
- **Email**: [Resend](https://resend.com/) `6.5.2`
- **UUID**: `uuid` `13.0.0`
- **Toast Notifications**: `sonner` `2.0.7`

## Testing

- **Unit/Integration**: [Vitest](https://vitest.dev/) `4.0.10`
- **E2E**: [Playwright](https://playwright.dev/) `1.56.1`
- **Testing Library**: `@testing-library/react` `16.3.0`

## Dev Tools

## Security & Versioning Policy

### Strict Versioning

We enforce **strict versioning** for all dependencies. This means we do not use caret (`^`) or tilde (`~`) prefixes in `package.json`.

- **Why?**: To prevent "works on my machine" issues and ensure that every environment (dev, CI, prod) runs the exact same code.
- **How to Update**: Use `pnpm up <package>@latest` to explicitly update a package and pin the new version.

### Engine Enforcement

We enforce strict Node.js and pnpm versions to ensure environment consistency.

- **Node.js**: `>=20.0.0`
- **pnpm**: `>=10.22.0`

### Security Audits

We recommend running `pnpm audit` regularly to detect vulnerabilities.

- **CI/CD**: The CI pipeline should block builds if high-severity vulnerabilities are found.
