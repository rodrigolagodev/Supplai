# Análisis Arquitectónico: Sistema de Chat y Creación de Órdenes

## Tabla de Contenidos

1. [Contexto y Misión](#contexto-y-misión)
2. [Arquitectura Actual](#arquitectura-actual)
3. [Análisis de Fortalezas](#análisis-de-fortalezas)
4. [Problemas Identificados](#problemas-identificados)
5. [Evaluación vs Patrones de Diseño](#evaluación-vs-patrones-de-diseño)
6. [Propuesta de Refactorización](#propuesta-de-refactorización)
7. [Plan de Implementación](#plan-de-implementación)

---

## Contexto y Misión

### Misión del Proyecto

**Automatizar gestión de pedidos en restaurantes mediante voz/texto con clasificación AI inteligente.**

### Usuarios Objetivo

- **Chefs y compradores** trabajando en cocinas
- **Ambiente adverso**: manos ocupadas, frío, ruido, fin de jornada cansada
- **Requerimiento crítico**: Cero curva de aprendizaje, voz-primero

### Flujo Core

```
Voice/Text Input → Transcription → AI Parsing → Classification → Review → Delivery
```

### Principios de Diseño

1. **Unidireccional** (solo envío, no respuestas)
2. **Revisión humana obligatoria**
3. **Cero curva de aprendizaje**

### Objetivos de Escalabilidad

- Multi-tenant (organizaciones)
- Cientos de órdenes por día por organización
- Audio processing en tiempo real
- Clasificación AI precisa y rápida

---

## Arquitectura Actual

### Stack Tecnológico

```
Frontend: Next.js 16 (App Router) + React 19 + Tailwind 4
Backend: Server Actions + Supabase (PostgreSQL)
AI: Groq Whisper v3 + Gemini 2.0 Flash
Queue: Custom Job Queue (database-backed)
Storage: Supabase Storage
Email: Resend
```

### Flujo de Datos Actual

```
┌─────────────────────────────────────────────────────────────┐
│ 1. USER INPUT                                               │
│    ├─ Text: ChatInput → processText()                       │
│    └─ Audio: VoiceRecorderButton → processTranscription()   │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. STATE MANAGEMENT (OrderChatContext)                      │
│    ├─ ensureOrderExists() → Lazy creation                   │
│    ├─ addMessage() → Optimistic UI update                   │
│    └─ saveConversationMessage() → Server Action             │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. PERSISTENCE (Supabase)                                   │
│    ├─ orders table (draft status)                           │
│    ├─ order_conversations table                             │
│    └─ order_audio_files table                               │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. PROCESSING (User clicks "Procesar Pedido")               │
│    ├─ processOrderBatch() → Aggregate messages              │
│    ├─ parseOrderText() → Gemini AI                          │
│    ├─ saveParsedItems() → order_items table                 │
│    └─ Redirect to /orders/[id]/review                       │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. REVIEW & SEND                                            │
│    ├─ User edits items                                      │
│    ├─ finalizeOrder() → sendOrder()                         │
│    ├─ createSupplierOrders()                                │
│    ├─ JobQueue.enqueue()                                    │
│    └─ Cron processes jobs → NotificationService             │
└─────────────────────────────────────────────────────────────┘
```

### Componentes Clave

#### 1. OrderChatContext (Estado Central)

**Ubicación**: `src/context/OrderChatContext.tsx`

**Responsabilidades**:

- Gestión de estado local (orderId, messages, isProcessing)
- Creación lazy de órdenes
- Sincronización optimista con servidor
- Orquestación de audio/texto

**Estado**:

```typescript
interface OrderChatContextType {
  orderId: string | null;
  messages: Message[];
  isProcessing: boolean;
  currentStatus: string;
  ensureOrderExists: () => Promise<string>;
  addMessage: (role, content, audioFileId?) => Promise<void>;
  processAudio: (audioBlob) => Promise<void>;
  processTranscription: (result) => Promise<void>;
  processText: (text) => Promise<void>;
  processOrder: () => Promise<void>;
}
```

#### 2. useAudioTranscription Hook

**Ubicación**: `src/hooks/useAudioTranscription.ts`

**Patrón**: State Machine con 8 estados

```
idle → recording → recorded → validating → uploading
                                     ↓
                           transcribing → success
                                     ↓
                                  error (retryable)
```

**Características**:

- Idempotencia (SHA-256 hashing)
- Rate limiting (10/hora)
- Validación (25MB, 5min)
- Retry automático

#### 3. Server Actions

**Ubicación**: `src/app/(protected)/orders/actions.ts`

**Funciones principales**:

- `createDraftOrder()`: Crea orden vacía
- `saveConversationMessage()`: Persiste mensajes
- `processOrderBatch()`: Agrega conversación → AI → Items
- `saveParsedItems()`: Bulk insert items
- `sendOrder()`: Crea supplier_orders + jobs

---

## Análisis de Fortalezas

### ✅ Puntos Fuertes

#### 1. **Lazy Order Creation**

- No crea órdenes vacías
- Reduce database clutter
- UX fluida (usuario no nota creación)

#### 2. **Optimistic UI Updates**

- Mensajes aparecen inmediatamente
- Servidor sync en background
- Experiencia responsive

#### 3. **State Machine para Audio**

- Estados explícitos y mutuamente exclusivos
- Validación en capas
- Idempotencia garantizada
- Error handling robusto

#### 4. **Separation of Concerns**

- Context para UI state
- Server Actions para business logic
- Services para dominio (OrderService, JobQueue)
- Database como source of truth

#### 5. **Job Queue Pattern**

- Desacoplamiento de envío de emails
- Retry automático (3 intentos)
- Tracking de estado
- Cron-based processing

#### 6. **Multi-tenant Ready**

- RLS en Supabase
- Organization-scoped data
- User permissions via memberships

---

## Problemas Identificados

### 🔴 Críticos

#### 1. **Acoplamiento Contexto-Navegación**

**Problema**:

```typescript
const ensureOrderExists = async () => {
  const newOrder = await createDraftOrder(organizationId);
  setOrderId(newOrder.id);

  // ❌ Router logic inside state management
  setTimeout(() => {
    router.replace(`/orders/${newOrder.id}`);
  }, 0);

  return newOrder.id;
};
```

**Impacto**:

- Violación de Single Responsibility Principle
- Dificulta testing
- Side effects ocultos
- Navegación acoplada a estado

**Solución Ideal**:
Context emite eventos, componente maneja navegación

---

#### 2. **Conversación como Aggregate Root Débil**

**Problema**:

- Mensajes se guardan individualmente
- No hay concepto de "conversación completa"
- Difícil reconstruir historial cronológico
- No hay transaccionalidad entre mensaje y audio

**Ejemplo del problema**:

```typescript
// Mensaje se guarda OK
await saveConversationMessage(orderId, 'user', transcription, audioFileId);

// Pero si falla después, quedamos con mensaje sin orden procesada
// No hay rollback natural
```

**Impacto**:

- Estado inconsistente posible
- Dificulta auditoría
- Complicado implementar "undo"

---

#### 3. **Duplicación de Lógica de Creación**

**Problema**:

```typescript
// En addMessage()
const currentOrderId = await ensureOrderExists();

// En processAudio() del OLD context
let currentOrderId = orderId;
if (!currentOrderId) {
  const newOrder = await createDraftOrder(organizationId);
  currentOrderId = newOrder.id;
  setOrderId(currentOrderId);
  router.replace(...);
}
```

**Impacto**:

- DRY violation
- Múltiples fuentes de verdad
- Bugs sutiles (el fix del setTimeout)

---

#### 4. **Estado Temporal en Múltiples Lugares**

**Problema**:

- `isProcessing` en OrderChatContext
- `currentStatus` en OrderChatContext
- Audio state en useAudioTranscription
- No hay sincronización garantizada

**Escenario problemático**:

```
User graba audio → useAudioTranscription.state = 'transcribing'
User cancela navegación → OrderChatContext.isProcessing = false
Pero audio sigue procesando en background
```

---

### 🟡 Moderados

#### 5. **Message Ordering No Garantizado**

**Problema**:

```typescript
setMessages(prev => [...prev, newMessage]); // Optimistic
await saveConversationMessage(...); // Async, puede fallar
```

Si múltiples mensajes se envían rápidamente, el orden en DB puede no coincidir con UI.

---

#### 6. **No hay Command/Query Separation**

**Problema**:

```typescript
// Mismo método hace dos cosas
const processOrder = async () => {
  // 1. Query: Fetch messages
  // 2. Command: Parse, save items, update status
  // 3. Side effect: Redirect
};
```

**Impacto**:

- Dificulta cacheo
- Testing complejo
- No se pueden reintentar commands idempotentemente

---

#### 7. **Falta de Event Sourcing**

**Problema**:

- Solo guardamos estado final (messages, items)
- No guardamos eventos ("order created", "item added", "audio uploaded")
- Dificulta debugging: "¿Cómo llegamos a este estado?"

**Ejemplo útil de eventos**:

```
OrderCreated { orderId, userId, timestamp }
MessageAdded { orderId, messageId, content, role }
AudioUploaded { orderId, audioId, duration }
AudioTranscribed { audioId, transcription, confidence }
OrderProcessed { orderId, itemsCount }
OrderSent { orderId, supplierIds[] }
```

---

### 🟢 Mejoras Opcionales

#### 8. **Polling vs WebSockets para Estado Real-Time**

Actualmente: Reload manual para ver cambios

Ideal:

- Supabase Realtime subscriptions
- Ver cuando otros usuarios procesan órdenes
- Notificaciones de jobs completados

---

#### 9. **No hay Offline Support**

Si usuario pierde conexión mientras graba:

- Audio se pierde
- Mensajes no se envían
- No hay retry queue client-side

---

#### 10. **Falta de Undo/Redo**

Usuario no puede deshacer:

- Mensaje enviado accidentalmente
- Audio transcrito incorrectamente
- Procesamiento prematuro

---

## Evaluación vs Patrones de Diseño

### Patrón 1: **CQRS (Command Query Responsibility Segregation)**

**Estado Actual**: ❌ No implementado

**Problema**:

```typescript
// processOrderBatch() mezcla reads y writes
const processOrderBatch = async orderId => {
  // Query
  const { data: messages } = await supabase.from('order_conversations').select('*');

  // Command
  await supabase.from('order_items').delete();
  await supabase.from('order_items').insert(items);
};
```

**Propuesta**:

```typescript
// Queries (read-only)
class OrderQueries {
  async getConversation(orderId): Promise<Message[]>;
  async getOrderSummary(orderId): Promise<OrderSummary>;
  async getUnprocessedOrders(): Promise<Order[]>;
}

// Commands (write-only, side effects)
class OrderCommands {
  async createOrder(orgId): Promise<OrderId>;
  async addMessage(orderId, message): Promise<MessageId>;
  async processOrder(orderId): Promise<void>;
  async sendOrder(orderId): Promise<void>;
}
```

**Beneficios**:

- Queries cacheables
- Commands idempotentes
- Optimización independiente
- Testing más fácil

---

### Patrón 2: **Event Sourcing**

**Estado Actual**: ❌ No implementado

**Propuesta**:

```typescript
// Event Store
interface OrderEvent {
  id: string;
  orderId: string;
  type: OrderEventType;
  payload: unknown;
  userId: string;
  timestamp: Date;
  version: number; // Optimistic concurrency
}

type OrderEventType =
  | 'ORDER_CREATED'
  | 'MESSAGE_ADDED'
  | 'AUDIO_UPLOADED'
  | 'AUDIO_TRANSCRIBED'
  | 'ORDER_PROCESSED'
  | 'ITEM_CLASSIFIED'
  | 'ORDER_SENT';

// Reconstruir estado desde eventos
class OrderAggregate {
  apply(event: OrderEvent) {
    switch (event.type) {
      case 'ORDER_CREATED':
        this.id = event.payload.orderId;
        this.status = 'draft';
        break;
      case 'MESSAGE_ADDED':
        this.messages.push(event.payload);
        break;
      // ...
    }
  }
}
```

**Beneficios**:

- Auditoría completa
- Time travel debugging
- Replay de eventos
- Event-driven arquitectura
- Fácil añadir projections

**Trade-offs**:

- Complejidad adicional
- Storage overhead
- Learning curve

**Recomendación**: **NO implementar en MVP**, considerar para v2 si necesitamos:

- Compliance/auditoría estricta
- Analytics avanzados
- Multiple read models

---

### Patrón 3: **State Machine (ya implementado parcialmente)**

**Estado Actual**: ✅ Implementado en `useAudioTranscription`

**Propuesta**: Extender a Order Lifecycle

```typescript
// Order State Machine
type OrderState =
  | { status: 'idle' } // No order yet
  | { status: 'drafting'; orderId: string; messages: Message[] }
  | { status: 'processing'; orderId: string }
  | { status: 'reviewing'; orderId: string; items: OrderItem[] }
  | { status: 'sending'; orderId: string; jobIds: string[] }
  | { status: 'sent'; orderId: string; sentAt: Date }
  | { status: 'error'; orderId: string; error: Error };

// Transiciones explícitas
type OrderAction =
  | { type: 'CREATE_ORDER'; organizationId: string }
  | { type: 'ADD_MESSAGE'; content: string }
  | { type: 'PROCESS_ORDER' }
  | { type: 'SEND_ORDER' };

function orderReducer(state: OrderState, action: OrderAction): OrderState {
  // Validar transiciones permitidas
  // Prevenir estados inválidos
}
```

**Beneficios**:

- Transiciones explícitas
- Estados imposibles = imposibles
- Testing exhaustivo
- Visualización clara del flujo

---

### Patrón 4: **Repository Pattern**

**Estado Actual**: ❌ Parcial (Server Actions mezclan con lógica)

**Problema**:

```typescript
// Server Action con SQL directo
export async function saveConversationMessage(orderId, role, content) {
  const { data } = await supabase
    .from('order_conversations')
    .insert({ order_id: orderId, role, content });
}
```

**Propuesta**:

```typescript
// Repository abstrae persistencia
interface IOrderRepository {
  findById(id: string): Promise<Order | null>;
  save(order: Order): Promise<void>;
  findConversation(orderId: string): Promise<Message[]>;
  addMessage(orderId: string, message: Message): Promise<void>;
}

// Implementación Supabase
class SupabaseOrderRepository implements IOrderRepository {
  async save(order: Order) {
    await this.supabase.from('orders').upsert(order);
  }
}

// En tests: Mock repository
class InMemoryOrderRepository implements IOrderRepository {
  private orders = new Map();
  async save(order) {
    this.orders.set(order.id, order);
  }
}
```

**Beneficios**:

- Abstracción de datos
- Testing sin DB
- Cambio de backend fácil
- Business logic desacoplada

---

### Patrón 5: **Saga Pattern (para flujo completo)**

**Estado Actual**: ❌ No implementado

**Problema**: Flujo multi-step sin compensación

```
Create Order → Add Messages → Process AI → Save Items → Send
   ↓              ↓              ↓            ↓          ↓
  OK            OK           FAIL          ❓         ❓

  ¿Qué hacemos con orden y mensajes?
```

**Propuesta**:

```typescript
class OrderProcessingSaga {
  async execute(orderId: string) {
    const compensations = [];

    try {
      // Step 1: Fetch messages
      const messages = await this.queries.getConversation(orderId);
      compensations.push(() => {
        /* no-op */
      });

      // Step 2: Parse with AI
      const items = await this.ai.parseOrder(messages);
      compensations.push(() => {
        /* no-op, AI is idempotent */
      });

      // Step 3: Save items
      await this.commands.saveItems(orderId, items);
      compensations.push(async () => {
        await this.commands.deleteItems(orderId);
      });

      // Step 4: Mark as processed
      await this.commands.updateOrderStatus(orderId, 'review');
      compensations.push(async () => {
        await this.commands.updateOrderStatus(orderId, 'draft');
      });
    } catch (error) {
      // Rollback en orden inverso
      for (const compensate of compensations.reverse()) {
        await compensate();
      }
      throw error;
    }
  }
}
```

**Beneficios**:

- Rollback automático
- Consistencia eventual
- Resiliente a fallos parciales

**Trade-off**: Complejidad

---

## Propuesta de Refactorización

### Opción A: **Mejoras Incrementales (Recomendado para ahora)**

**Objetivo**: Resolver problemas críticos sin reescribir todo

#### Cambios Propuestos

##### 1. Separar Navegación de Estado

```typescript
// OrderChatContext.tsx
const ensureOrderExists = async () => {
  if (orderId) return orderId;

  const newOrder = await createDraftOrder(organizationId);
  setOrderId(newOrder.id);

  // ✅ Emit event instead of navigating
  onOrderCreated?.(newOrder.id);

  return newOrder.id;
};

// Component que usa el context
function OrderChatPage() {
  const { ensureOrderExists, ... } = useOrderChat();
  const router = useRouter();

  const handleOrderCreated = useCallback((orderId: string) => {
    router.replace(`/orders/${orderId}`);
  }, [router]);

  return (
    <OrderChatProvider onOrderCreated={handleOrderCreated}>
      ...
    </OrderChatProvider>
  );
}
```

**Beneficio**: Context testeable sin router

---

##### 2. Centralizar Lógica de Creación

```typescript
// useOrderLifecycle.ts (nuevo hook)
export function useOrderLifecycle(organizationId: string) {
  const [orderId, setOrderId] = useState<string | null>(null);
  const orderIdRef = useRef<Promise<string> | null>(null);

  const ensureOrderExists = useCallback(async () => {
    if (orderId) return orderId;

    // Prevent duplicate creation (race condition)
    if (!orderIdRef.current) {
      orderIdRef.current = createDraftOrder(organizationId);
    }

    const newOrderId = await orderIdRef.current;
    setOrderId(newOrderId);
    return newOrderId;
  }, [orderId, organizationId]);

  return { orderId, ensureOrderExists };
}
```

**Beneficio**: Single source of truth, previene race conditions

---

##### 3. Introducir Command Pattern

```typescript
// commands/OrderCommands.ts
export class OrderCommands {
  constructor(
    private repository: IOrderRepository,
    private eventBus?: EventBus
  ) {}

  async addMessage(
    orderId: string,
    message: { role: 'user' | 'assistant'; content: string; audioFileId?: string }
  ): Promise<string> {
    const messageId = crypto.randomUUID();

    await this.repository.addMessage(orderId, {
      id: messageId,
      ...message,
      createdAt: new Date(),
    });

    this.eventBus?.emit('MESSAGE_ADDED', { orderId, messageId, ...message });

    return messageId;
  }

  async processOrder(orderId: string): Promise<void> {
    const messages = await this.repository.findConversation(orderId);
    const items = await parseOrderText(messages);
    await this.repository.saveItems(orderId, items);

    this.eventBus?.emit('ORDER_PROCESSED', { orderId, itemCount: items.length });
  }
}

// En Server Action
export async function processOrderBatch(orderId: string) {
  const commands = new OrderCommands(new SupabaseOrderRepository());
  await commands.processOrder(orderId);
  return { success: true };
}
```

**Beneficio**: Testeable, reusable, event-driven ready

---

##### 4. Mejorar Message Ordering

```typescript
// En addMessage
const addMessage = async (role, content, audioFileId?) => {
  const currentOrderId = await ensureOrderExists();

  // Generate sequence number
  const sequenceNumber = messages.length + 1;

  const newMessage = {
    id: crypto.randomUUID(),
    order_id: currentOrderId,
    role,
    content,
    audio_file_id: audioFileId,
    sequence_number: sequenceNumber, // ✅ Nuevo
    created_at: new Date().toISOString(),
  };

  setMessages(prev => [...prev, newMessage]);

  await saveConversationMessage(currentOrderId, role, content, audioFileId, sequenceNumber);
};

// Schema update
ALTER TABLE order_conversations
ADD COLUMN sequence_number INTEGER NOT NULL DEFAULT 0;

CREATE INDEX idx_order_conversations_sequence
ON order_conversations(order_id, sequence_number);
```

**Beneficio**: Orden garantizado, queries eficientes

---

##### 5. Extraer Audio Logic a Service

```typescript
// services/AudioService.ts
export class AudioService {
  async uploadAndTranscribe(
    blob: Blob,
    orderId: string
  ): Promise<{ transcription: string; audioFileId: string }> {
    // 1. Validate
    this.validate(blob);

    // 2. Check idempotency
    const hash = await this.hashBlob(blob);
    const existing = await this.findByHash(orderId, hash);
    if (existing) return existing;

    // 3. Upload
    const audioFileId = await this.upload(blob, orderId);

    // 4. Transcribe
    const transcription = await this.transcribe(audioFileId);

    // 5. Save
    await this.saveTranscription(audioFileId, transcription);

    return { transcription, audioFileId };
  }
}

// useAudioTranscription usa AudioService internamente
```

**Beneficio**: Reusable en otros contextos, testeable

---

### Opción B: **Refactorización Profunda (Post-MVP)**

**Objetivo**: Arquitectura event-driven con CQRS

#### Estructura Propuesta

```
src/
├── domain/
│   ├── order/
│   │   ├── Order.ts                 # Aggregate Root
│   │   ├── OrderState.ts            # State Machine
│   │   ├── OrderEvents.ts           # Event definitions
│   │   └── OrderCommands.ts         # Command handlers
│   ├── message/
│   │   ├── Message.ts
│   │   └── MessageEvents.ts
│   └── audio/
│       ├── Audio.ts
│       └── AudioEvents.ts
├── application/
│   ├── commands/
│   │   ├── CreateOrderCommand.ts
│   │   ├── AddMessageCommand.ts
│   │   └── ProcessOrderCommand.ts
│   ├── queries/
│   │   ├── GetOrderQuery.ts
│   │   └── GetConversationQuery.ts
│   └── sagas/
│       └── OrderProcessingSaga.ts
├── infrastructure/
│   ├── repositories/
│   │   ├── SupabaseOrderRepository.ts
│   │   └── SupabaseEventStore.ts
│   ├── services/
│   │   ├── GroqTranscriptionService.ts
│   │   └── GeminiParsingService.ts
│   └── eventBus/
│       └── EventBus.ts
└── presentation/
    └── context/
        └── OrderChatContext.tsx   # Thin wrapper over commands/queries
```

**Beneficios**:

- Escalabilidad horizontal
- Event replay
- Multiple read models
- Microservices-ready

**Trade-offs**:

- Complejidad 3x
- Learning curve
- Over-engineering para escala actual

---

## Plan de Implementación

### Fase 1: **Estabilización (1-2 días)** ✅ COMPLETADO

- [x] Fix router.replace interruption
- [x] Fix orderId availability
- [x] Audio idempotency

### Fase 2: **Mejoras Incrementales (3-5 días)** 🎯 RECOMENDADO AHORA

#### Prioridad Alta

1. **Separar navegación de estado** (4 horas)
   - Añadir `onOrderCreated` callback
   - Mover router logic a componente
   - Tests

2. **Centralizar order creation** (2 horas)
   - Crear `useOrderLifecycle` hook
   - Prevenir race conditions
   - Migrar context a usar hook

3. **Message sequence numbers** (3 horas)
   - Migration para agregar columna
   - Actualizar saves
   - Index optimization

#### Prioridad Media

4. **Introducir Command Pattern** (6 horas)
   - Crear `OrderCommands` class
   - Extraer lógica de Server Actions
   - Tests unitarios

5. **Audio Service extraction** (4 horas)
   - Crear `AudioService`
   - Migrar lógica de hook
   - Integration tests

6. **Basic Event Bus** (4 horas)
   - EventBus simple (in-memory)
   - Emit eventos desde commands
   - Listeners para analytics

#### Prioridad Baja

7. **Repository Pattern** (8 horas)
   - `IOrderRepository` interface
   - `SupabaseOrderRepository` implementation
   - Mock repository para tests

8. **CQRS básico** (6 horas)
   - `OrderQueries` class
   - Separar reads de writes
   - Cache layer

### Fase 3: **Optimizaciones (1 semana)** 📅 POST-MVP

9. **State Machine para Order** (8 horas)
10. **Saga Pattern** (12 horas)
11. **Supabase Realtime** (6 horas)
12. **Offline support** (16 horas)

### Fase 4: **Arquitectura Avanzada (2-3 semanas)** 🔮 FUTURO

13. **Event Sourcing** (si se necesita auditoría estricta)
14. **CQRS completo con projections**
15. **Microservices split** (si escala lo requiere)

---

## Métricas de Éxito

### Performance

- [ ] Tiempo de creación de orden < 100ms
- [ ] Tiempo de transcripción < 5s (95th percentile)
- [ ] Tiempo de procesamiento AI < 3s
- [ ] Message ordering 100% correcto

### Escalabilidad

- [ ] Soportar 1000 órdenes/día por organización
- [ ] Concurrent audio uploads sin degradación
- [ ] Job queue procesa 100 jobs/minuto

### Calidad de Código

- [ ] Coverage de tests > 80%
- [ ] 0 errores de TypeScript strict
- [ ] 0 warnings de ESLint
- [ ] Lighthouse performance > 90

### User Experience

- [ ] Time to Interactive < 2s
- [ ] Audio recording feedback < 100ms
- [ ] Message appears instantly (optimistic UI)
- [ ] 0 mensajes perdidos

---

## Recomendación Final

### Para AHORA (próximos 7 días):

**✅ Implementar Fase 2 (Mejoras Incrementales)**

**Razones**:

1. Resuelve problemas críticos actuales
2. No requiere reescritura completa
3. Mejora testability significativamente
4. Bajo riesgo, alto retorno
5. Fundación para futuras mejoras

**Prioridades en orden**:

1. Separar navegación (evita bugs futuros)
2. Message sequence numbers (garantiza consistencia)
3. Command Pattern (mejora testing y reusabilidad)

### Para POST-MVP:

**🎯 Event Bus + Basic CQRS**

Cuando tengamos:

- 10+ organizaciones activas
- Necesidad de analytics
- Múltiples consumers de eventos
- Requisitos de auditoría

### NO hacer ahora:

**❌ Event Sourcing**
**❌ Microservices**
**❌ Saga Pattern complejo**

Son over-engineering para escala actual.

---

## Conclusión

La arquitectura actual es **sólida para MVP** pero tiene **deuda técnica táctica** que debe resolverse antes de escalar.

**Fortalezas a mantener**:

- Lazy creation
- Optimistic UI
- Audio state machine
- Job queue pattern

**Mejoras críticas**:

- Separar concerns (navegación, estado, persistencia)
- Message ordering garantizado
- Command pattern para reusabilidad
- Testing mejorado

**Path forward**:

```
Actual → Mejoras Incrementales → Event Bus → CQRS → (Event Sourcing si es necesario)
```

Este approach balances **pragmatismo** (shipping features) con **calidad** (code maintainability) y **escalabilidad** (foundation for growth).
