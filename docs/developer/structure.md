# Project Structure

This document provides a detailed map of the **Supplai** codebase.

## Root Directory

- `.agent/`: Agent-specific configurations and workflows.
- `.gemini/`: Project guidelines and context for AI assistants.
- `docs/`: This documentation folder.
- `e2e/`: End-to-End tests (Playwright).
- `public/`: Static assets (images, fonts).
- `scripts/`: Utility scripts (e.g., database seeding).
- `src/`: Source code.
- `supabase/`: Supabase configuration and migrations.

## Source Code (`src/`)

### `src/app/` (Next.js App Router)

- `(auth)/`: Authentication routes (login, register).
- `(protected)/`: Protected application routes (dashboard, orders).
- `api/`: API Routes.
- `auth/`: Auth callback handling.
- `layout.tsx`: Root layout.
- `globals.css`: Global styles.

### `src/components/`

- `ui/`: Reusable UI components (buttons, inputs, dialogs) - mostly Shadcn UI.
- `auth/`: Auth-related components (forms).
- `dashboard/`: Dashboard widgets.
- `navigation/`: Sidebar, header.
- `orders/`: Order management components (list, details, chat).

### `src/lib/`

- `ai/`: AI logic (Gemini, Groq integration).
- `db/`: Database schema and client.
- `email/`: Email templates and sending logic (Resend).
- `queue/`: Job queue definitions.
- `supabase/`: Supabase client initialization (server/client).
- `utils.ts`: General utility functions.

### `src/features/` (Feature-based architecture)

- `orders/`: Order-specific logic (actions, services).

### `src/domain/`

- `types.ts`: Core domain entities and interfaces.

## Supabase (`supabase/`)

- `migrations/`: SQL migration files.
- `functions/`: Edge Functions (Deno).
- `config.toml`: Local Supabase config.
