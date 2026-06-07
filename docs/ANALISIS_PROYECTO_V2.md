# Project Analysis & Improvement Plan

## Executive Summary

The project is a modern Next.js 16 application using Supabase and AI integration. It has a strong foundation but suffers from architectural inconsistencies and some "growing pains" typical of rapid development. The most critical issues are the mix of architectural patterns (Feature-based vs. Clean Architecture), the presence of a "God file" for server actions, and repetitive authentication logic.

## 1. Architectural Analysis

### Current State

The project currently exhibits a **Hybrid Architecture**, which creates confusion:

- **Feature-based:** `src/features/orders` exists and follows a standard pattern.
- **Clean Architecture:** `src/application`, `src/domain`, and `src/infrastructure` exist but seem partially implemented or redundant.
- **Shared Components:** `src/components` contains feature-specific code (`history`, `suppliers`) alongside generic UI components.

### Recommendation: Consolidate to Feature-Based Architecture

Move away from the rigid Clean Architecture layers and fully embrace the Feature-based approach, which aligns better with Next.js App Router.

- **Move:** `src/application/commands/OrderCommands.ts` -> `src/features/orders/server/services/order-service.ts`
- **Move:** `src/components/history` -> `src/features/history/components` (or `src/features/orders/components/history`)
- **Move:** `src/components/suppliers` -> `src/features/suppliers/components`
- **Keep:** `src/components/ui` for truly shared, atomic components (buttons, inputs, etc.).

## 2. Code Quality & Duplication

### Issue: The "God File" (`actions.ts`)

`src/app/(protected)/orders/actions.ts` is nearly 30KB and over 1000 lines. It handles:

- Database CRUD operations
- Authentication & Authorization
- Business Logic
- AI Integration
- Response Formatting

**Risk:** High coupling, difficult testing, and merge conflicts.

### Recommendation: Split & Refactor

Break `actions.ts` into specialized files within the feature folder:

- `src/features/orders/actions/create-order.ts`
- `src/features/orders/actions/process-message.ts`
- `src/features/orders/actions/sync-orders.ts`
- `src/features/orders/queries/get-order.ts`

### Issue: Repetitive Auth Logic

Almost every function in `actions.ts` repeats this pattern:

```typescript
const supabase = await createClient();
const { data: { user } } = await supabase.auth.getUser();
if (!user) throw new Error('Unauthorized');
const { data: membership } = await supabase... // check membership
if (!membership) throw new Error('Forbidden');
```

### Recommendation: Auth Middleware/Wrapper

Create a reusable higher-order function or utility to handle this context.

```typescript
// src/lib/auth/context.ts
export async function getAuthedContext(organizationId?: string) {
  // ... handles user and membership check
  return { user, membership, supabase };
}
```

## 3. Database & Sync

### Current State

- **Supabase:** Primary source of truth.
- **Dexie:** Local cache/offline storage.
- **Sync:** `src/lib/db/sync.ts` handles synchronization manually.

### Observations

- `sync.ts` iterates items one-by-one (`for (const order of pendingOrders)`). This is inefficient for large datasets.
- Legacy code (`cleanLegacyAudioUrls`) is present in the sync loop.

### Recommendation

- **Batch Operations:** Use `supabase.from('orders').upsert([...])` to sync multiple items in a single request.
- **Cleanup:** Remove one-off migration scripts from the critical sync path once they have run.

## 4. Performance & Styling

### Tailwind 4

The project uses Tailwind 4, which is excellent. However, `src/app/globals.css` mixes v3 concepts (`@layer base` for variables) with v4 (`@theme inline`).

- **Action:** Standardize on the v4 CSS-first configuration approach for cleaner stylesheets.

### Bundle Size

The large `actions.ts` imports many dependencies. Splitting it will help tree-shaking and reduce the server bundle size for specific routes.

## 5. Roadmap for Improvement

1.  **Refactor Auth:** Create `getAuthedContext` helper.
2.  **Split Actions:** Decompose `actions.ts` into granular files.
3.  **Reorganize Structure:** Move `src/components/{history,suppliers}` to `src/features`.
4.  **Optimize Sync:** Implement batch upserts in `sync.ts`.
5.  **Cleanup:** Remove unused Clean Architecture folders (`src/application`, etc.) if they are not strictly needed.

## Conclusion

The project is well-positioned but needs a "refactoring sprint" to pay down technical debt before adding more features. Adopting a strict Feature-based structure and abstracting common patterns will significantly improve developer velocity and maintainability.
