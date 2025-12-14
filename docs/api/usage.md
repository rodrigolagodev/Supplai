# API Usage

## Authentication

**Supplai** uses Supabase Auth. All API requests must be authenticated.

### Client-Side

Requests made from the browser (Client Components) automatically include the session cookie.

### Server-Side / External

To access the API externally, you must provide a valid Bearer token (JWT) in the `Authorization` header.

```http
Authorization: Bearer <your-access-token>
```

## Error Handling

The API returns standard HTTP status codes:

- `200 OK`: Success.
- `400 Bad Request`: Invalid input.
- `401 Unauthorized`: Missing or invalid token.
- `403 Forbidden`: Insufficient permissions.
- `500 Internal Server Error`: Server-side issue.

## Usage Examples

### Fetching Orders (Client)

```typescript
import { createClient } from '@/utils/supabase/client';

const supabase = createClient();
const { data, error } = await supabase.from('orders').select('*').eq('status', 'review');
```

### Sending a Chat Message (Fetch)

```typescript
const response = await fetch('/api/chat', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    messages: [{ role: 'user', content: 'Add 5kg of onions' }],
    orderId: '123-abc',
  }),
});
```
