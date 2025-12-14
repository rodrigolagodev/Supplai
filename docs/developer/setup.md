# Setup & Installation

Follow these instructions to set up the **Supplai** development environment.

## Prerequisites

- **Node.js**: Version 20 or higher (LTS recommended).
- **pnpm**: Version 10.22.0 or higher.
- **Docker**: Required for local Supabase development.
- **Supabase CLI**: Install via `npm install -g supabase`.

## Installation

1. **Clone the repository:**

   ```bash
   git clone https://github.com/rodrigolagodev/supplai.git
   cd supplai
   ```

2. **Install dependencies:**

   ```bash
   pnpm install
   ```

3. **Environment Configuration:**
   Copy the example environment file:
   ```bash
   cp .env.example .env.local
   ```
   Fill in the required environment variables in `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase project URL.
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Your Supabase anonymous key.
   - `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase service role key (for backend/admin tasks).
   - `GOOGLE_GENERATIVE_AI_API_KEY`: API key for Gemini.
   - `GROQ_API_KEY`: API key for Groq (Whisper).
   - `RESEND_API_KEY`: API key for Resend email service.
   - `NEXT_PUBLIC_SITE_URL`: The base URL of the application (e.g., `http://localhost:3000`).

## Local Database Setup (Supabase)

1. **Start Supabase:**

   ```bash
   supabase start
   ```

   This will spin up the local Supabase stack (Postgres, Auth, Storage, Edge Functions) in Docker containers.

2. **Apply Migrations:**

   ```bash
   supabase migration up
   ```

   This applies the database schema to your local instance.

3. **Seed Data (Optional):**
   If there is a seed file available:
   ```bash
   supabase db reset
   ```

## Running the Application

1. **Start the development server:**

   ```bash
   pnpm dev
   ```

2. **Open the app:**
   Navigate to [http://localhost:3000](http://localhost:3000) in your browser.

## Additional Commands

- **Linting:** `pnpm lint`
- **Formatting:** `pnpm format`
- **Type Checking:** `pnpm tsc --noEmit`
