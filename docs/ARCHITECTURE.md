# System Architecture

This document describes the high-level architecture of the PedidosAI system, focusing on the Order Management flow.

## High-Level Architecture

The system follows a **Service-Oriented Architecture** pattern within a Next.js application. It separates concerns into:

1.  **Presentation Layer**: React Server/Client Components.
2.  **Action Layer**: Server Actions that handle user input and orchestration.
3.  **Service Layer**: Business logic and domain rules.
4.  **Data Layer**: Supabase (PostgreSQL) with Row Level Security (RLS).

```mermaid
graph TD
    subgraph Frontend ["Frontend (Next.js)"]
        UI[React Components]
        Review[OrderReviewBoard]
    end

    subgraph Backend ["Server Actions & Services"]
        Action[Server Actions]
        OrderSvc[OrderService]
        QueueSvc[JobQueue]
        NotifSvc[NotificationService]
    end

    subgraph Database ["Supabase (PostgreSQL)"]
        DB[(Database)]
        Jobs[Jobs Table]
        Orders[Orders Tables]
    end

    subgraph External ["External Services"]
        Resend[Resend API]
    end

    UI --> Action
    Review --> Action
    Action --> OrderSvc
    Action --> QueueSvc

    OrderSvc --> Orders
    QueueSvc --> Jobs
    QueueSvc --> NotifSvc
    NotifSvc --> Resend

    style Frontend fill:#e1f5fe,stroke:#01579b
    style Backend fill:#fff3e0,stroke:#e65100
    style Database fill:#e8f5e9,stroke:#1b5e20
    style External fill:#f3e5f5,stroke:#4a148c
```

## Order Processing Flow (Async Queue)

The order sending process is decoupled using an asynchronous job queue pattern to ensure reliability and responsiveness.

```mermaid
sequenceDiagram
    actor User
    participant UI as Frontend
    participant Action as Server Action (sendOrder)
    participant OrderSvc as OrderService
    participant Queue as JobQueue
    participant DB as Database (Jobs)
    participant Notif as NotificationService
    participant Email as Resend API

    User->>UI: Click "Send Order"
    UI->>Action: finalizeOrder()
    Action->>OrderSvc: createSupplierOrders()
    OrderSvc->>DB: Insert supplier_orders (pending)

    Action->>Queue: enqueue(send_email_job)
    Queue->>DB: Insert Job (pending)

    Action->>Queue: processPending()
    Note over Queue, DB: Fetches pending jobs for user

    loop For each Job
        Queue->>Notif: executeJob()
        Notif->>Email: sendSupplierOrder()
        Email-->>Notif: 200 OK

        alt Success
            Notif-->>Queue: Success
            Queue->>DB: Update Job (completed)
            Queue->>OrderSvc: updateStatus(sent)
        else Failure
            Notif-->>Queue: Error
            Queue->>DB: Update Job (failed, retry++)
            Queue->>OrderSvc: updateStatus(failed)
        end
    end

    Action-->>UI: Success (Redirect)
    UI-->>User: Show Confirmation
```

## Database Schema (ERD)

Key relationships for the Order Management module.

```mermaid
erDiagram
    users ||--o{ memberships : "has"
    organizations ||--o{ memberships : "has"
    organizations ||--o{ suppliers : "owns"
    organizations ||--o{ orders : "owns"

    orders ||--|{ order_items : "contains"
    suppliers ||--o{ order_items : "supplies"

    orders ||--|{ supplier_orders : "split_into"
    suppliers ||--o{ supplier_orders : "receives"

    users ||--o{ jobs : "creates"

    orders {
        uuid id PK
        uuid organization_id FK
        string status
        timestamp created_at
    }

    order_items {
        uuid id PK
        uuid order_id FK
        uuid supplier_id FK
        string product
        float quantity
        string unit
    }

    supplier_orders {
        uuid id PK
        uuid order_id FK
        uuid supplier_id FK
        string status
        string error_message
    }

    jobs {
        uuid id PK
        uuid user_id FK
        string type
        jsonb payload
        string status
        int attempts
    }
```
