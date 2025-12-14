# Components & Interactions

## UI Component Library

We use a set of reusable components built on **Radix UI** and styled with **Tailwind CSS**. These are located in `src/components/ui`.

### Key Components

- **`Button`**: Standard button with variants (default, destructive, outline, ghost).
- **`Dialog`**: Modal for confirmations and forms.
- **`Form`**: Wrapper around `react-hook-form` components.
- **`ScrollArea`**: Custom scrollable container.
- **`Toast`**: Notification system (via `sonner`).

## Feature Components

### Order Chat (`src/components/orders/chat/`)

- **`ChatInterface`**: Main container for the chat view.
- **`MessageList`**: Renders the list of messages (user/assistant).
- **`AudioRecorder`**: Handles microphone access and recording state.
- **`OrderPreview`**: Shows the current state of the parsed order items.

### Dashboard (`src/components/dashboard/`)

- **`OrderCard`**: Summary card for an order.
- **`StatsOverview`**: Metrics display.

## Interaction Patterns

### Server vs. Client Components

- **Server Components**: Used for fetching data (e.g., `page.tsx`). They access Supabase directly.
- **Client Components**: Used for interactivity (forms, chat, recording). They use `createClient` (browser version) or call Server Actions.

### Data Fetching

1.  **Server-Side**: `await supabase.from('...').select()` in `page.tsx`. Passed as props to Client Components.
2.  **Client-Side**: `useEffect` or `swr`/`tanstack-query` (if needed) for real-time updates, though we prefer Server Actions for mutations.

### State Management

- **Local State**: `useState` for simple UI state.
- **URL State**: Search params for filters and pagination.
- **Server State**: Relies on Next.js caching and revalidation (`revalidatePath`).
