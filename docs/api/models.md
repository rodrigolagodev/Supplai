# Data Models

This document outlines the core data models and database schema used in **Supplai**.

## Database Schema (Supabase/PostgreSQL)

### `organizations`

Represents a restaurant or business entity.

- `id`: UUID (PK)
- `name`: Text
- `slug`: Text (Unique)

### `users` (Managed by Supabase Auth)

- `id`: UUID (PK, references `auth.users`)
- `full_name`: Text
- `avatar_url`: Text

### `suppliers`

Suppliers associated with an organization.

- `id`: UUID (PK)
- `organization_id`: UUID (FK)
- `name`: Text
- `category`: Enum (`vegetables`, `meat`, `bakery`, etc.)
- `contact_method`: Enum (`whatsapp`, `email`)

### `orders`

The central entity representing a purchase order.

- `id`: UUID (PK)
- `organization_id`: UUID (FK)
- `status`: Enum (`draft`, `review`, `sent`, `archived`)
- `created_by`: UUID (FK)

### `order_items`

Individual items within an order.

- `id`: UUID (PK)
- `order_id`: UUID (FK)
- `product`: Text
- `quantity`: Numeric
- `unit`: Enum (`kg`, `unit`, `liter`, etc.)
- `supplier_id`: UUID (FK, optional)

### `order_messages`

Chat history associated with an order context.

- `id`: UUID (PK)
- `order_id`: UUID (FK)
- `role`: Enum (`user`, `assistant`, `system`)
- `content`: Text
- `type`: Enum (`text`, `audio`)

## TypeScript Interfaces

Key interfaces from `src/domain/types.ts`:

```typescript
export interface Order {
  id: string;
  organization_id: string;
  status: 'draft' | 'review' | 'sent' | 'archived';
  created_at: string;
  // ...
}

export interface OrderItem {
  id: string;
  order_id: string;
  product: string;
  quantity: number;
  unit: string;
  // ...
}
```

## Enums

### `OrderStatus`

- `draft`: Initial state, being built.
- `review`: Ready for human review.
- `sent`: Sent to suppliers.
- `archived`: Completed and hidden.

### `SyncStatus` (Local-First)

- `pending`: Not yet synced to server.
- `synced`: Successfully saved to Supabase.
- `failed`: Sync failed, retry needed.
