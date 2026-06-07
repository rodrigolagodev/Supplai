## Análisis de arquitectura y calidad de código

### Visión general

- **Estado actual**:
  - Arquitectura basada en **Next.js App Router** con separación clara entre capas: presentación (`src/app`, componentes UI), dominio/feature (`src/features`), servicios (`src/services`), utilidades y capa de datos con Supabase (`src/lib/db`, `supabase/` y tipos generados).
  - Uso de **Service-Oriented Architecture** a nivel interno, bien documentado en `docs/ARCHITECTURE.md`.
  - Integraciones cuidadas con **Supabase** (auth, storage, RLS) y **modelos de IA** (Gemini, Groq).

- **Patrones y buenas prácticas aplicadas**:
  - **Patrones de diseño**:
    - Command pattern (`lib/queue/types.ts`, comandos como `SendMessageCommand`, `CallAICommand`, `OrderCommands`).
    - **Message Queue** en cliente (`lib/queue/MessageQueue.ts`) con reintentos y backoff.
    - **Job Queue** asíncrona en backend (`services/queue`, Supabase Edge Function `supabase/functions/process-job`), según lo descrito en `docs/ARCHITECTURE.md`.
    - **Service Layer** para dominio de pedidos: `OrderService`, `NotificationService`, `OrderCommands`.
    - **EventBus** (`lib/events/EventBus.ts`) para eventos de dominio (`message:sent`, `error:occurred`, `queue:status_changed`).
    - **State Machine** explícita para la conversación (`lib/state/ConversationStateMachine.ts` + `hooks/useConversationState.ts`).
  - **Capas**:
    - Presentación: componentes React server/client bien aislados (`app/(protected)`, `features/orders/components/*`, `components/ui/*`).
    - Acciones servidor: `features/orders/actions/*`, `lib/auth/actions.ts`.
    - Servicios de dominio: `features/orders/server/services/*`, `services/orders.ts`, `services/notifications.ts`.
    - Datos: Supabase (`lib/supabase/*`, `lib/db/schema.ts`, migraciones SQL).
  - **IA / parsing**:
    - `lib/ai/gemini.ts` con validación fuerte vía **Zod** (`ParsedItemSchema`, `ParseResultSchema`), normalización de unidades/categorías y helper `withRetry` con backoff.
    - Uso coherente en:
      - `/app/api/parse-order/route.ts`
      - `features/orders/actions/process-message.ts` (`processBatchMessages`, `processOrderBatch`)
      - `OrderCommands.processOrder` (transforma mensajes en `order_items`).
  - **Auth y autorización**:
    - `lib/auth/session.ts` centraliza `getSession`, `getSessionOrRedirect`, `getUserOrganizations`, `getOrganizationBySlug`, `getUserRole`, `isUserAdmin`, `getDefaultOrganization`.
    - Rutas API (`/api/chat`, `/api/process-audio`, `/api/parse-order`) validan usuario + pertenencia a `organization_id` mediante `memberships`.

### Fortalezas

- **Arquitectura moderna y escalable**:
  - División clara por features (`src/features/orders`, `src/features/history`, `src/features/suppliers`).
  - Documentación de arquitectura (`docs/ARCHITECTURE.md`, `EMAIL_QUEUE_ARCHITECTURE.md`, etc.) de muy buena calidad.
  - Uso de patrones de resiliencia (reintentos, backoff, colas, separación async) que mejoran robustez.

- **Flujo de pedidos y chat bien diseñado**:
  - `OrderChatContext` orquesta:
    - Mensajes locales (`useLocalMessages`, `useLocalOrder`).
    - Estado de conexión (`useNetworkStatus`, `SyncContext`).
    - Cola de comandos (`MessageQueue` + `SendMessageCommand` / `CallAICommand`).
    - State machine de conversación (`useConversationState`).
  - `OrderChatInterface` mantiene UI limpia, delegando la complejidad al contexto y hooks.

- **Buena calidad de código general**:
  - Uso intensivo de **TypeScript** (tipos de Supabase, interfaces de dominio, Zod).
  - Estructura de componentes pequeña y enfocada.
  - Manejo razonable de errores (logs claros, validación de inputs en APIs).

### Debilidades y oportunidades detectadas

1. **Dispersión de la lógica de dominio de pedidos**
   - `OrderCommands` (en `features/orders/server/services/order-commands.ts`) concentra gran parte de la lógica: agregar mensajes, procesar conversación, enviar pedidos.
   - A la vez, existen `OrderService` (`services/orders.ts`) y `NotificationService` (`services/notifications.ts`) con otras partes del dominio (supplier orders, envío de emails).
   - Esto genera cierta ambigüedad sobre “dónde vive” la lógica central de órdenes.

2. **Duplicación de lógica de autorización por orden**
   - Varias rutas API (`/api/chat`, `/api/process-audio`, `/api/parse-order`) duplican:
     - `createClient`, `auth.getUser`,
     - lectura de `orders.organization_id`,
     - verificación de `memberships`.
   - Ya existe un helper `getOrderContext(orderId)` (en `lib/auth/context`) que se usa en `features/orders/actions/process-message.ts`, pero no está reutilizado en todas partes.

3. **Parsing de pedidos con Gemini repartido en varios sitios**
   - `parseOrderText` se invoca directamente en:
     - `/app/api/parse-order/route.ts`
     - `OrderCommands.processOrder`
     - `processBatchMessages`
   - La lógica “de dominio” (combinar mensajes, cargar suppliers, normalizar campos, manejar errores) se reparte, pudiendo derivar en comportamientos ligeramente distintos.

4. **OrderChatContext demasiado cargado**
   - `OrderChatContext` mezcla:
     - Manejo del input de texto.
     - Manejo de audio (upload + transcripción).
     - Debounce y encolado de comandos.
     - Integración con state machine.
     - Gestión de sincronización offline/online.
   - Esto dificulta la lectura y futuros refactors.

5. **Dependencias de hooks incompletas**
   - En `OrderChatContext`, el `useMemo` que construye `contextValue` no incluye todas las dependencias (por ejemplo, `sendMessage`, `pendingCount`, `updateTypingActivity`, `cancelDebounce`, `isRecording`, `setIsRecording`, `isAssistantTyping`).
   - Esto puede causar closures obsoletos y bugs sutiles en la UI.

6. **Tipos y `any` mejorables**
   - Algunos usos de `as any` (principalmente en `redirect`) y `eslint-disable @typescript-eslint/no-explicit-any`.
   - Tipos ad-hoc como `{ role: string; content: string }` en vez de tipos de dominio (`OrderMessage`) basados en `Database`.

7. **Manejo de errores y logging heterogéneo**
   - Uso de `console.error` / `console.warn` repartido sin una capa de logging consistente.
   - Respuestas de error en APIs con estructuras levemente distintas (a veces solo `error: string`, sin códigos).

---

## Plan de implementación de mejoras

El plan se organiza en **4 fases principales** (más una fase opcional de documentación/QA), pensadas para poder ejecutarse en sprints cortos.

### Fase 1 – Unificación del dominio de “orders” y servicios

**Objetivo**: Tener una única capa clara de dominio de pedidos, que agrupe lógica de procesamiento, creación de supplier orders y envío.

- **1. Crear módulo de dominio de pedidos**
  - Crear un módulo, por ejemplo:
    - `src/features/orders/server/domain/OrderDomain.ts`  
      o, si se prefiere separar de `features`, `src/lib/orders/index.ts`.
  - Exponer funciones de alto nivel:
    - `processOrderConversation(orderId: string, organizationId: string)`
    - `sendOrderToSuppliers(orderId: string)`
    - `updateMainOrderStatus(orderId: string)`

- **2. Reubicar y alinear servicios existentes**
  - Mover o reexportar:
    - `OrderService` (actualmente en `src/services/orders.ts`) al nuevo módulo de dominio.
    - `NotificationService` (en `src/services/notifications.ts`) al mismo módulo o subcarpeta (`domain/notifications`).
  - Asegurarse de evitar dependencias circulares con `OrderCommands`:
    - Si es necesario, mantener `OrderCommands` como orquestador que delega en `OrderDomain`.

- **3. Ajustar entrypoints para usar el dominio unificado**
  - Refactorizar:
    - Acciones de `features/orders/actions/*` (`send-order`, `process-message`, `create-order`, etc.) para que llamen a funciones del nuevo dominio.
    - Supabase Function `supabase/functions/process-job/index.ts` para utilizar `OrderDomain.sendOrderToSuppliers`.

**Criterio de éxito**:  
Toda la lógica de negocio de pedidos (procesar conversación, crear supplier orders, enviar pedidos y actualizar estados) pasa por un módulo de dominio bien definido, con mínima duplicación.

---

### Fase 2 – Autorización y parsing centralizados

**Objetivo**: Reducir duplicación de lógica de seguridad y unificar el flujo de parsing con IA.

- **4. Centralizar contexto de orden + autorización**
  - Revisar `lib/auth/context.ts` y el helper `getOrderContext(orderId)`:
    - Asegurar que expone `{ supabase, user, order, membership }` o una estructura equivalente.
  - Refactorizar rutas y acciones que hoy duplican lógica de autorización:
    - `/app/api/chat/route.ts`
    - `/app/api/process-audio/route.ts`
    - `/app/api/parse-order/route.ts`
    - Cualquier otra acción que valide manualmente `orders.organization_id` + `memberships`.
  - Sustituir el código repetido por llamadas a `getOrderContext(orderId)`.

- **5. Crear un `OrderParsingService`**
  - Añadir un servicio de dominio, por ejemplo:
    - `src/features/orders/server/services/OrderParsingService.ts`.
  - Responsabilidades:
    - Recibir `text` + `organizationId`.
    - Cargar suppliers de la organización.
    - Invocar `parseOrderText` (Gemini) con contexto de suppliers.
    - Devolver items normalizados, con `supplier_id`, `classification_confidence`, etc.
  - Refactors asociados:
    - `OrderCommands.processOrder` debe delegar el parsing en `OrderParsingService`.
    - `processBatchMessages` puede reutilizar el mismo servicio cuando tenga sentido (o al menos compartir lógica de construcción de texto y contexto).
    - `/api/parse-order` puede delegar el parseo en `OrderParsingService` si se quiere evitar duplicación.

**Criterio de éxito**:  
Todas las rutas/acciones que parsean pedidos usan un flujo de negocio común, y la autorización por orden se centraliza en helpers reutilizables.

---

### Fase 3 – Refactor de `OrderChatContext`, colas y máquina de estados

**Objetivo**: Simplificar la lógica del chat, hacer más claro el uso de colas y mejorar mantenibilidad.

- **6. Renombrar/documentar colas (cliente vs backend)**
  - Opcionalmente renombrar:
    - `lib/queue/MessageQueue` → `ClientMessageQueue` o `ConversationQueue`, para que se distinga de la Job Queue de backend (`services/queue`).
  - Actualizar `docs/ARCHITECTURE.md` con una sección “Two queue layers”:
    - Explicar:
      - Cola de cliente: controla mensajes del usuario, reintentos, debounce de llamadas a la IA.
      - Cola backend (jobs): procesa envíos de emails a suppliers de forma asíncrona.

- **7. Extraer hooks específicos desde `OrderChatContext`**
  - Crear hooks como:
    - `useChatMessageQueue(orderId, isOnline, addMessage, updateMessage, dispatch)`:
      - Encapsula creación y configuración de `MessageQueue`.
      - Encolado de `SendMessageCommand` y `CallAICommand`.
      - Manejo del debounce para llamar a la IA tras X ms sin nuevos mensajes.
    - `useAudioProcessing(orderId, addMessage, updateMessage, isOnline, sendMessage)`:
      - Encapsula toda la lógica de `processAudio` (upload + transcripción + actualización de mensaje + reuso de `sendMessage`).
  - Dejar `OrderChatContext` principalmente como:
    - Gestor de `input`, `isProcessing`, `pendingCount`.
    - Composición de hooks (`useConversationState`, `useNetworkStatus`, hooks extraídos).

- **8. Corregir dependencias de hooks (`useMemo`, `useCallback`)**
  - En `OrderChatContext`, revisar:
    - `useMemo` de `contextValue`: añadir todos los elementos que se exponen en el objeto (entre ellos `sendMessage`, `pendingCount`, `updateTypingActivity`, `cancelDebounce`, `isRecording`, `setIsRecording`, `isAssistantTyping`).
  - Revisar otros hooks complejos donde sea fácil pasar por alto dependencias:
    - `useLocalMessages`, `useLocalOrder`, `useConversationState` y hooks relacionados con sincronización.

**Criterio de éxito**:  
`OrderChatContext` es más pequeño y fácil de entender; el flujo de conversación está encapsulado en hooks reutilizables y no hay advertencias de dependencias faltantes en hooks.

---

### Fase 4 – Tipos de dominio, manejo de errores y DX

**Objetivo**: Fortalecer el tipado, reducir `any`, homogeneizar errores y mejorar la experiencia de desarrollo.

- **9. Definir tipos de dominio reutilizables**
  - Crear un archivo de tipos de dominio, por ejemplo:
    - `src/features/orders/types.ts` o `src/types/orders.ts`.
  - Definir tipos como:
    - `OrderMessage` (derivado de `Database['public']['Tables']['order_conversations']['Row']`).
    - `ParsedOrderItem` (basado en `ParsedItem` de `lib/ai/gemini.ts`, pero con los campos tal como se usan en el dominio).
    - `SupplierOrder`, `OrderItemWithSupplier`, etc.
  - Sustituir tipos genéricos y objetos sueltos en:
    - `OrderCommands`, `processBatchMessages`, `OrderChatContext`.
    - Componentes de UI de review (`OrderReview*`) y chat (`MessageList`, `ChatInput`, etc.), cuando proceda.

- **10. Reducir `any` y `eslint-disable` innecesarios**
  - Buscar en el repo los usos de:
    - `eslint-disable @typescript-eslint/no-explicit-any`
    - `as any`
  - Para cada caso:
    - Evaluar si se puede introducir un tipo de dominio en su lugar.
    - En el caso de `redirect`, valorar envolverlo en un helper tipado que oculte la necesidad de `as any`.

- **11. Unificar manejo de errores y logging**
  - Crear util de logging, por ejemplo `src/lib/utils/logging.ts`:
    - `logInfo(context: string, data?: unknown)`
    - `logError(context: string, error: unknown, extra?: unknown)`
  - Reemplazar `console.error` / `console.warn` en los puntos críticos:
    - Integraciones AI (`Gemini`, `Groq`), envío de emails, audio, Job Queue.
  - Estandarizar respuestas de error en APIs:
    - Trabajar con un formato tipo:
      - `{ error: { code: string; message: string } }`
    - Mapear en el cliente a mensajes amigables (`toast`) y decisiones de reintento.

**Criterio de éxito**:  
Menos `any` y `eslint-disable`, tipos de dominio usados de forma transversal, y un esquema de errores consistente entre APIs y cliente.

---

### Fase opcional – Documentación, tests y QA

**Objetivo**: Consolidar el conocimiento y asegurar que los cambios no rompen flujos críticos.

- **12. Actualizar documentación**
  - Ampliar `docs/ARCHITECTURE.md` con:
    - El nuevo módulo de dominio de orders.
    - `OrderParsingService`.
    - Explicación de la doble capa de colas (cliente vs backend).
  - Añadir breves diagramas mermaid si hace falta para los nuevos flujos.

- **13. Añadir/ajustar tests**
  - Tests unitarios para:
    - `OrderParsingService` (texto de pedido → items esperados).
    - `OrderCommands.processOrder` (mock de Supabase).
    - `ConversationStateMachine` (ya está aislada, es ideal para tests de transición).
  - Tests de integración donde tenga sentido (ej. flujo completo de creación de pedido + procesamiento + envío).

**Criterio de éxito**:  
La documentación describe con precisión la arquitectura actualizada, y hay una cobertura razonable de tests en los puntos de mayor riesgo (parsing, dominio de pedidos, colas).
