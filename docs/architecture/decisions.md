# Architecture Decisions

This document records key technical decisions and their rationale.

## ADR-001: Next.js App Router

- **Decision**: Use Next.js 16 with App Router.
- **Rationale**: Provides the latest React features (Server Components, Streaming), better performance, and seamless Vercel integration.
- **Status**: Accepted.

## ADR-002: Supabase for Backend

- **Decision**: Use Supabase as the backend-as-a-service.
- **Rationale**: Drastically reduces development time for Auth, DB, and Storage. Postgres is a robust relational DB suitable for order management.
- **Status**: Accepted.

## ADR-003: Tailwind CSS v4

- **Decision**: Adopt Tailwind CSS v4 (alpha/beta).
- **Rationale**: Simplified configuration (no `postcss.config.js` needed), better performance, and future-proofing.
- **Status**: Accepted.

## ADR-004: AI Model Selection

- **Decision**:
  - **Parsing/Chat**: Gemini 1.5 Flash. (Cost-effective, fast, large context window).
  - **Transcription**: Groq (Whisper). (Extremely fast inference, critical for voice UX).
- **Status**: Accepted.

## ADR-005: Local-First Drafts

- **Decision**: Use `Dexie.js` for storing order drafts in the browser before syncing.
- **Rationale**: Prevents data loss if the network is flaky during a long order creation session. Improves perceived performance.
- **Status**: Accepted.
