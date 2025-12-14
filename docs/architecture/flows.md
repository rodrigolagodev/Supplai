# User Flows

This document details the critical user journeys in **Supplai**.

## 1. Order Creation (Voice/Text)

The core value proposition is creating orders via natural language.

```mermaid
sequenceDiagram
    actor User
    participant UI as Order Chat UI
    participant Audio as Audio Service
    participant AI as Gemini API
    participant DB as Supabase DB

    User->>UI: Records Audio
    UI->>Audio: Upload & Transcribe (Groq)
    Audio-->>UI: Transcription Text
    UI->>AI: Parse Text (Extract Items)
    AI-->>UI: Structured Items JSON
    UI->>DB: Save Draft Order
    DB-->>UI: Order ID
    UI-->>User: Show Draft Order
```

## 2. Order Review & Processing

After creation, the user reviews the order and sends it.

```mermaid
sequenceDiagram
    actor User
    participant UI as Review Page
    participant API as Classify API
    participant DB as Supabase DB
    participant Email as Resend Service

    User->>UI: Open Draft Order
    UI->>API: Classify Items (Assign Suppliers)
    API-->>UI: Items with Suppliers
    User->>UI: Confirm/Edit Suppliers
    User->>UI: Click "Process Order"
    UI->>DB: Update Status to 'sent'
    UI->>Email: Send Emails to Suppliers
    Email-->>UI: Success
    UI-->>User: Order Sent Confirmation
```

## 3. User Invitation Flow

How new users join an organization.

```mermaid
sequenceDiagram
    actor Admin
    participant UI as Team Settings
    participant DB as Supabase DB
    participant Email as Resend Service
    actor NewUser

    Admin->>UI: Invite User (Email)
    UI->>DB: Create Invitation Record
    UI->>Email: Send Invitation Link
    Email->>NewUser: Receive Email
    NewUser->>UI: Click Link
    UI->>DB: Validate Token
    UI->>NewUser: Show Registration Form
    NewUser->>UI: Create Account
    UI->>DB: Create User & Membership
    DB-->>UI: Success
```
