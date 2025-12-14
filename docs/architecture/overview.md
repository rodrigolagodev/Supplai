# System Architecture Overview

**Supplai** is designed as a modern, cloud-native web application leveraging serverless technologies and AI services.

## Tech Stack

- **Frontend**: Next.js 16 (App Router), React 19, Tailwind CSS 4.
- **Backend**: Supabase (PostgreSQL, Auth, Storage, Edge Functions).
- **AI Services**:
  - **Google Gemini 1.5 Flash**: For natural language understanding, order parsing, and chat.
  - **Groq (Whisper)**: For ultra-fast audio transcription.
- **Infrastructure**: Vercel (Hosting), Supabase (Database/Auth).

## System Context Diagram

```mermaid
graph TD
    User[User (Chef/Manager)] -->|Voice/Text| App[Next.js App (Vercel)]
    App -->|Auth/Data| Supabase[Supabase (DB, Auth)]
    App -->|Transcribe| Groq[Groq API (Whisper)]
    App -->|Parse/Chat| Gemini[Google Gemini API]
    App -->|Send Email| Resend[Resend API]

    subgraph "Supabase"
        DB[(PostgreSQL)]
        Auth[GoTrue]
        Storage[S3 Compatible]
    end

    Supabase --> DB
```

## Key Architectural Patterns

### 1. Serverless & Edge First

The application runs primarily on Vercel's Edge Network and Serverless Functions. This ensures low latency and high scalability.

### 2. Local-First (Partial)

For the order creation flow, we use `Dexie.js` (IndexedDB) to store draft orders locally. This provides a snappy experience and offline resilience before syncing to the server.

### 3. AI as a Service

Complex logic like parsing unstructured text or transcribing audio is offloaded to specialized AI APIs (Gemini, Groq), keeping the application logic clean and focused on business rules.

### 4. Feature-Based Organization

Code is organized by feature (e.g., `src/features/orders`) rather than just technical layer, making it easier to maintain and scale specific domains.
