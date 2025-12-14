# API Endpoints

This document details the public API endpoints and Server Actions available in **Supplai**.

## API Routes

### Chat

**Endpoint**: `/api/chat`
**Method**: `POST`
**Description**: Handles chat interactions with the AI assistant.
**Request Body**:

```json
{
  "messages": [{ "role": "user", "content": "Hello" }],
  "orderId": "uuid-string"
}
```

**Response**: Streaming text response from the AI.

### Classify Items

**Endpoint**: `/api/classify-items`
**Method**: `POST`
**Description**: Classifies order items into categories and assigns suppliers.
**Request Body**:

```json
{
  "items": [{ "product": "Tomatoes", "quantity": 5, "unit": "kg" }],
  "organizationId": "uuid-string"
}
```

### Parse Order

**Endpoint**: `/api/parse-order`
**Method**: `POST`
**Description**: Parses natural language text into structured order items.
**Request Body**:

```json
{
  "text": "I need 5kg of tomatoes and 20 buns",
  "organizationId": "uuid-string"
}
```

### Process Audio

**Endpoint**: `/api/process-audio`
**Method**: `POST`
**Description**: Transcribes audio files using Groq (Whisper) and processes the content.
**Request Body**: `FormData` with `file` (audio blob) and `orderId`.

### Auth Callback

**Endpoint**: `/auth/callback`
**Method**: `GET`
**Description**: Handles the OAuth callback from Supabase Auth. Exchange code for session.

## Server Actions

Server actions are located in `src/actions/` (or co-located in feature folders). They are functions that run on the server and can be called directly from Client Components.

_(Note: Specific server actions should be documented here as they are identified in the codebase)_
