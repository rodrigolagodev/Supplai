# Plan de Optimización: Chat de Pedidos con IA

**Fecha:** 1 de Diciembre, 2025
**Objetivo:** Transformar el chat de captura de pedidos en una experiencia conversacional fluida y natural, manteniendo el procesamiento JSON final.

---

## 1. ANÁLISIS DE PROBLEMAS ACTUALES

### 1.1 Problemas de UX Identificados

#### ❌ Sin Conversación Real-Time

- **Problema:** El chat usa un sistema de debouncing de 5 segundos
- **Impacto:** El usuario escribe un mensaje y debe esperar 5s para ver respuesta
- **Evidencia:** `useDebouncedAIResponse.ts` - `DEBOUNCE_DELAY = 5000ms`
- **Consecuencia:** Se siente lento, no parece un chat real

#### ❌ Respuestas No Conversacionales

- **Problema:** El asistente solo responde con resúmenes de parsing
- **Ejemplo actual:**
  ```
  Usuario: "Hola, necesito hacer un pedido"
  [Espera 5 segundos...]
  Asistente: "He procesado 0 productos. ¿Algo más?"
  ```
- **Esperado:**
  ```
  Usuario: "Hola, necesito hacer un pedido"
  Asistente: "¡Hola! Con gusto te ayudo. ¿Qué productos necesitas?"
  ```

#### ❌ Sin Contexto Conversacional

- **Problema:** No hay memoria de la conversación más allá del parsing
- **Evidencia:** `processBatchMessages` solo concatena texto para parsing
- **Consecuencia:** No puede responder preguntas, aclarar dudas, o tener diálogo natural

#### ❌ Sin Indicadores de Actividad

- **Problema:** No hay "typing indicators" ni feedback visual inmediato
- **Consecuencia:** Usuario no sabe si el sistema está procesando

#### ❌ Endpoint de Chat Streaming No Utilizado

- **Problema:** Existe `/api/chat/route.ts` pero no se usa
- **Oportunidad:** Ya tienes infraestructura para streaming, solo falta integrar

#### ❌ Experiencia Offline Inconsistente

- **Problema:** Si se pierde conexión, el usuario no sabe si puede seguir escribiendo
- **Riesgo:** Pérdida de datos o frustración al intentar enviar
- **Necesidad:** Queue de mensajes y feedback visual claro de "guardado localmente"

### 1.2 Lo Que Funciona Bien ✅

- **Offline-first:** IndexedDB con sincronización es robusto
- **Transcripción de audio:** Groq Whisper funciona excelente
- **Parsing de pedidos:** Gemini 2.0 Flash es efectivo para extraer items
- **Clasificación de proveedores:** Sistema de keywords y categorías funciona
- **UI de chat:** Componentes base (MessageList, ChatInput) son sólidos

---

## 2. PROPUESTA DE SOLUCIÓN

### 2.1 Arquitectura Propuesta: Modo Dual

#### Modo 1: Conversación (Nuevo)

- **Propósito:** Interacción natural con el usuario
- **Comportamiento:** Respuesta inmediata con streaming
- **Modelo:** Gemini 2.0 Flash (conversacional)
- **Características:**
  - Responde preguntas sobre productos
  - Aclara dudas sobre cantidades/unidades
  - Confirma items a medida que se dictan
  - Sugiere productos comunes
  - Mantiene contexto conversacional

#### Modo 2: Procesamiento (Actual mejorado)

- **Propósito:** Extraer items estructurados del pedido completo
- **Comportamiento:** Se activa solo al finalizar conversación
- **Modelo:** Gemini 2.0 Flash (parsing)
- **Características:**
  - Analiza toda la conversación
  - Extrae items en formato JSON
  - Clasifica por proveedor
  - Genera resumen final estructurado

#### Modo 3: Offline (Nuevo)

- **Propósito:** Permitir captura de pedidos sin conexión
- **Comportamiento:** Store-and-forward
- **Características:**
  - Detecta pérdida de conexión automáticamente
  - Guarda mensajes en cola local (IndexedDB)
  - Simula respuesta de "recibido" (local echo)
  - Sincroniza automáticamente al recuperar conexión

### 2.2 Flujo de Usuario Mejorado

```
┌─────────────────────────────────────────────────────────────┐
│ FASE 1: CONVERSACIÓN INICIAL                                 │
├─────────────────────────────────────────────────────────────┤
│ Usuario: "Hola, necesito hacer un pedido"                   │
│ [Respuesta inmediata, 1-2s]                                 │
│ Asistente: "¡Hola! Claro, te ayudo. Dime qué productos     │
│             necesitas y en qué cantidades."                 │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ FASE 2: CAPTURA DE PRODUCTOS (CONVERSACIONAL)               │
├─────────────────────────────────────────────────────────────┤
│ Usuario: "Dame 3 kilos de tomate"                           │
│ [Streaming, respuesta casi inmediata]                       │
│ Asistente: "Perfecto, 3 kg de tomate anotados. ¿Qué más    │
│             necesitas?"                                     │
│                                                             │
│ Usuario: "y medio kilo de cebolla"                         │
│ Asistente: "Entendido, medio kg de cebolla. ¿Algo más?"   │
│                                                             │
│ Usuario: "Cuánto cuesta el queso?"                         │
│ Asistente: "No tengo información de precios en este       │
│             momento, pero puedo agregar queso al pedido.  │
│             ¿Cuánto quieres?"                             │
│                                                             │
│ Usuario: "Dale, poneme 2 kilos"                            │
│ Asistante: "Anotado, 2 kg de queso. ¿Necesitas algo más?" │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ FASE 3: CIERRE Y PROCESAMIENTO                              │
├─────────────────────────────────────────────────────────────┤
│ Usuario: "Eso es todo" / [Hace clic en "Procesar Pedido"] │
│                                                             │
│ [Sistema entra en modo parsing]                            │
│ Asistente: "Perfecto, estoy procesando tu pedido...       │
│                                                             │
│             📦 He procesado 4 productos:                   │
│             • 3 kg de Tomate (Verdulería López)           │
│             • 0.5 kg de Cebolla (Verdulería López)        │
│             • 2 kg de Queso (Lácteos San Juan)            │
│                                                             │
│             ¿Quieres revisar el pedido antes de enviar?"  │
│                                                             │
│ [Botón: "Revisar Pedido"]                                  │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ ESCENARIO OFFLINE                                           │
├─────────────────────────────────────────────────────────────┤
│ Usuario: "Agregame 10 leches"                               │
│ [Sin conexión detectada]                                    │
│                                                             │
│ Sistema: [Icono ☁️ tachado] "Sin conexión. Guardado local." │
│ Asistente (Local): "Mensaje guardado. Se procesará al       │
│                     recuperar conexión."                    │
│                                                             │
│ [Usuario sigue dictando...]                                 │
│                                                             │
│ [Conexión recuperada]                                       │
│ Sistema: "Sincronizando 3 mensajes..."                      │
│ Asistente: "Ya volví en línea. He anotado:                  │
│             • 10 leches                                     │
│             • [Otros items offline]                         │
│             ¿Algo más?"                                     │
└─────────────────────────────────────────────────────────────┘
```

### 2.3 Características Clave de la Solución

#### 🚀 Respuestas Streaming en Tiempo Real

- Usar el endpoint `/api/chat` existente
- Streaming con Vercel AI SDK (`streamText`)
- Latencia < 2 segundos para primera palabra
- Indicador "typing..." mientras genera

#### 🧠 Contexto Conversacional Completo

- El asistente tiene acceso a toda la conversación
- Puede responder preguntas contextualmente
- Recuerda items mencionados
- Puede aclarar y confirmar

#### 🎯 Modo Dual Inteligente

- **Durante conversación:** Modo conversacional activo
- **Al procesar:** Modo parsing para JSON estructurado
- Transición suave entre modos

#### 📱 Mejores Indicadores Visuales

- "Typing..." indicator animado
- Estado de conexión visible
- Confirmación visual al agregar items
- Progress bar durante procesamiento

#### 🔄 Mantiene Offline-First

- Mensajes siguen guardándose en IndexedDB
- Sincronización en background
- Modo degradado si no hay conexión

#### 🔌 Soporte Offline Robusto

- **Queue de Mensajes:** Los mensajes se encolan si no hay red
- **Local Echo:** El mensaje del usuario aparece inmediatamente con estado "pendiente"
- **Auto-Sync:** Reintento automático exponencial al volver online
- **Bloqueo Inteligente:** Deshabilita "Procesar Pedido" hasta sincronizar, pero permite seguir chateando

---

## 3. PLAN DE IMPLEMENTACIÓN

### FASE 1: Infraestructura de Chat Conversacional

**Duración estimada:** Fundación del nuevo sistema

#### Tarea 1.1: Actualizar OrderChatContext

**Archivo:** `/src/context/OrderChatContext.tsx`

**Cambios:**

1. **Eliminar debouncing de 5 segundos** para mensajes normales
2. **Agregar función `sendMessageImmediate()`:**

   ```typescript
   const sendMessageImmediate = async (content: string) => {
     // 1. Guardar mensaje user en IndexedDB
     const messageId = await addMessage(content, 'user', 'text');

     // 2. Sincronizar inmediatamente
     await syncPendingItems();

     // 3. Llamar a API de chat streaming
     const response = await fetch('/api/chat', {
       method: 'POST',
       body: JSON.stringify({ orderId, message: content }),
     });

     // 4. Procesar streaming
     const reader = response.body.getReader();
     let assistantMessage = '';
     const assistantId = uuid();

     // Crear mensaje placeholder
     await addMessage('[Escribiendo...]', 'assistant', 'text');

     // Stream chunks
     while (true) {
       const { done, value } = await reader.read();
       if (done) break;

       const chunk = new TextDecoder().decode(value);
       assistantMessage += chunk;

       // Actualizar mensaje en tiempo real
       await updateMessage(assistantId, { content: assistantMessage });
     }
   };
   ```

3. **Mantener `processFinalOrder()` para modo parsing:**

   ```typescript
   const processFinalOrder = async () => {
     setIsProcessing(true);

     // Modo parsing: analiza toda la conversación
     await processBatchMessages(orderId);

     setIsProcessing(false);
   };
   ```

**Archivos afectados:**

- `/src/context/OrderChatContext.tsx`

---

#### Tarea 1.4: Implementar Manejo Offline

**Archivo:** `/src/hooks/useNetworkStatus.ts` y `/src/context/OrderChatContext.tsx`

**Objetivo:** Gestionar estado de conexión y cola de mensajes.

1.  **Hook de detección de red:**

    ```typescript
    export function useNetworkStatus() {
      const [isOnline, setIsOnline] = useState(true);
      // Listeners para 'online' y 'offline' events
      return isOnline;
    }
    ```

2.  **Modificar `sendMessageImmediate` para offline:**

    ```typescript
    const sendMessageImmediate = async (content: string) => {
      // 1. Guardar siempre en local primero (status: 'pending_sync')
      const messageId = await addMessage(content, 'user', 'text', { status: 'pending_sync' });

      if (!isOnline) {
        // Si offline, mostrar feedback local y terminar
        await addMessage('Guardado localmente. Se enviará al conectar.', 'system', 'info');
        return;
      }

      // Si online, intentar sync y stream normal...
    };
    ```

3.  **Sync Manager:**
    - Efecto que escucha `isOnline`
    - Cuando `false -> true`: busca mensajes `pending_sync` y los envía
    - Actualiza UI al terminar sync

**Archivos afectados:**

- Nuevo: `/src/hooks/useNetworkStatus.ts`
- `/src/context/OrderChatContext.tsx`

---

#### Tarea 1.2: Mejorar API de Chat Streaming

**Archivo:** `/src/app/api/chat/route.ts`

**Mejoras necesarias:**

1. **System Prompt Conversacional:**

   ```typescript
   const CONVERSATIONAL_SYSTEM_PROMPT = `Eres un asistente amigable y eficiente para tomar pedidos de alimentos y productos.
   
   PERSONALIDAD:
   - Amable, profesional y conciso
   - Respondes de forma natural y conversacional
   - Confirmas cada producto que el usuario menciona
   - Eres proactivo en aclarar dudas
   
   TU ROL:
   - Ayudar al usuario a dictar su pedido de forma natural
   - Confirmar productos, cantidades y unidades
   - Responder preguntas sobre el proceso
   - NO tienes información de precios ni inventario
   - NO procesas el pedido final (eso es otro paso)
   
   FORMATO DE RESPUESTAS:
   - Cortas y directas (1-2 líneas máximo)
   - Confirma cada item con la cantidad
   - Usa emojis ocasionalmente (📦, ✅, 👍)
   - Si el usuario pregunta algo fuera de tu alcance, sé honesto
   
   EJEMPLOS:
   Usuario: "Hola"
   Tú: "¡Hola! ¿Qué productos necesitas para tu pedido?"
   
   Usuario: "3 kilos de tomate"
   Tú: "Perfecto, 3 kg de tomate ✅ ¿Algo más?"
   
   Usuario: "Cuánto cuesta?"
   Tú: "No tengo precios en este momento, pero puedo anotar los productos que necesitas. ¿Qué más agregas?"
   
   IMPORTANTE:
   - El usuario puede dictar varios productos en un solo mensaje
   - Confirma TODOS los productos mencionados
   - Si menciona cantidades sin unidades, pregunta la unidad
   - Si algo no está claro, pregunta para aclarar
   `;
   ```

2. **Agregar contexto de proveedores (opcional):**

   ```typescript
   // Fetch suppliers para dar contexto
   const suppliers = await getSuppliersByOrg(organizationId);
   const suppliersContext = suppliers.map(s => `- ${s.name}: ${s.category}`).join('\n');

   const systemPrompt = `${CONVERSATIONAL_SYSTEM_PROMPT}
   
   PROVEEDORES DISPONIBLES:
   ${suppliersContext}
   
   Puedes mencionar estos proveedores si el usuario pregunta.`;
   ```

3. **Mejorar manejo de historial:**

   ```typescript
   // Cargar últimos 20 mensajes para contexto
   const messages = await getRecentMessages(orderId, 20);

   const chatMessages = messages.map(m => ({
     role: m.role,
     content: m.content,
   }));
   ```

4. **Guardar respuesta del asistente:**

   ```typescript
   const { textStream, fullStream } = await streamText({
     model: google('gemini-2.0-flash-exp'),
     system: systemPrompt,
     messages: [...chatMessages, { role: 'user', content: message }],
     temperature: 0.7, // Más creativo para conversación
   });

   // Guardar en background después del stream
   let fullResponse = '';

   return new Response(
     new ReadableStream({
       async start(controller) {
         for await (const chunk of textStream) {
           fullResponse += chunk;
           controller.enqueue(new TextEncoder().encode(chunk));
         }

         // Guardar mensaje del asistente
         await saveConversationMessage({
           orderId,
           role: 'assistant',
           content: fullResponse,
         });

         controller.close();
       },
     })
   );
   ```

**Archivos afectados:**

- `/src/app/api/chat/route.ts`
- Nuevo: `/src/lib/ai/prompts.ts` (system prompts)

---

#### Tarea 1.3: Typing Indicator Component

**Nuevo archivo:** `/src/features/orders/components/TypingIndicator.tsx`

```typescript
'use client';

import { motion } from 'framer-motion';

export function TypingIndicator() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="flex items-center gap-2 px-4 py-2 bg-muted rounded-lg w-fit"
    >
      <div className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="w-2 h-2 bg-primary/60 rounded-full"
            animate={{
              y: [0, -8, 0],
              opacity: [0.6, 1, 0.6],
            }}
            transition={{
              duration: 0.6,
              repeat: Infinity,
              delay: i * 0.15,
            }}
          />
        ))}
      </div>
      <span className="text-sm text-muted-foreground">Escribiendo...</span>
    </motion.div>
  );
}
```

**Integrar en MessageList:**

```typescript
// En MessageList.tsx
{isAssistantTyping && <TypingIndicator />}
```

**Archivos afectados:**

- Nuevo: `/src/features/orders/components/TypingIndicator.tsx`
- `/src/features/orders/components/MessageList.tsx`

---

### FASE 2: Mejoras de UX y Feedback Visual

**Duración estimada:** Mejorar experiencia de usuario

#### Tarea 2.1: Rediseñar Message Bubbles

**Archivo:** `/src/features/orders/components/MessageList.tsx`

**Mejoras:**

1. **Agregar avatares:**

   ```typescript
   // Usuario: Iniciales o avatar
   // Asistente: Icono de bot
   ```

2. **Mejor diferenciación visual:**

   ```typescript
   const MessageBubble = ({ message, isUser }: Props) => {
     return (
       <motion.div
         initial={{ opacity: 0, y: 20 }}
         animate={{ opacity: 1, y: 0 }}
         className={cn(
           "flex gap-3 items-start",
           isUser ? "flex-row-reverse" : "flex-row"
         )}
       >
         {/* Avatar */}
         <div className={cn(
           "w-8 h-8 rounded-full flex items-center justify-center",
           isUser ? "bg-primary" : "bg-muted"
         )}>
           {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
         </div>

         {/* Mensaje */}
         <div className={cn(
           "max-w-[70%] rounded-2xl px-4 py-2",
           isUser
             ? "bg-primary text-primary-foreground"
             : "bg-muted"
         )}>
           {message.content}

           {/* Timestamp */}
           <div className="text-xs opacity-60 mt-1">
             {format(message.created_at, 'HH:mm')}
           </div>
         </div>
       </motion.div>
     );
   };
   ```

3. **Animaciones de entrada:**
   - Cada mensaje aparece con fade + slide
   - Typing indicator pulsa suavemente

**Archivos afectados:**

- `/src/features/orders/components/MessageList.tsx`

---

#### Tarea 2.2: Quick Replies / Sugerencias

**Nuevo archivo:** `/src/features/orders/components/QuickReplies.tsx`

**Propósito:** Sugerir acciones comunes al usuario

```typescript
'use client';

interface QuickReply {
  id: string;
  label: string;
  action: 'message' | 'finish';
  message?: string;
}

const QUICK_REPLIES: QuickReply[] = [
  { id: '1', label: 'Eso es todo', action: 'finish' },
  { id: '2', label: 'Agregar más', action: 'message', message: 'Quiero agregar más productos' },
  { id: '3', label: 'Productos frecuentes', action: 'message', message: 'Muéstrame mis productos frecuentes' },
];

export function QuickReplies({ onSelect }: Props) {
  return (
    <div className="flex gap-2 flex-wrap px-4 py-2">
      {QUICK_REPLIES.map((reply) => (
        <Button
          key={reply.id}
          variant="outline"
          size="sm"
          onClick={() => onSelect(reply)}
          className="rounded-full"
        >
          {reply.label}
        </Button>
      ))}
    </div>
  );
}
```

**Integrar en OrderChatInterface:**

- Mostrar después de respuesta del asistente
- Ocultar cuando usuario empieza a escribir

**Archivos afectados:**

- Nuevo: `/src/features/orders/components/QuickReplies.tsx`
- `/src/features/orders/components/OrderChatInterface.tsx`

---

#### Tarea 2.3: Progress Indicator para Procesamiento Final

**Archivo:** `/src/features/orders/components/ProcessButton.tsx`

**Mejorar feedback:**

```typescript
const ProcessButton = () => {
  const [stage, setStage] = useState<'idle' | 'syncing' | 'parsing' | 'done'>('idle');

  const handleProcess = async () => {
    setStage('syncing');
    await syncPendingItems();

    setStage('parsing');
    await processBatchMessages(orderId);

    setStage('done');
    router.push(`/orders/${orderId}/review`);
  };

  return (
    <Button onClick={handleProcess} disabled={stage !== 'idle'}>
      {stage === 'idle' && '📦 Procesar Pedido'}
      {stage === 'syncing' && '🔄 Sincronizando...'}
      {stage === 'parsing' && '🤖 Analizando pedido...'}
      {stage === 'done' && '✅ Listo!'}
    </Button>
  );
};
```

**Archivos afectados:**

- `/src/features/orders/components/ProcessButton.tsx`

---

#### Tarea 2.4: Indicadores de Estado de Conexión

**Archivo:** `/src/features/orders/components/ConnectionStatus.tsx`

**Componente visual:**

- Badge discreto en el header del chat
- Colores:
  - 🟢 Online (invisible o punto verde)
  - 🟡 Sincronizando (spinner)
  - 🔴 Offline (icono nube tachada + texto)

**Comportamiento:**

- Al perder conexión: Toast "Estás offline. Puedes seguir escribiendo."
- Al recuperar: Toast "Conexión recuperada. Sincronizando..."

**Archivos afectados:**

- Nuevo: `/src/features/orders/components/ConnectionStatus.tsx`
- `/src/features/orders/components/OrderChatInterface.tsx`

---

### FASE 3: Inteligencia Conversacional Avanzada

**Duración estimada:** Funcionalidades inteligentes

#### Tarea 3.1: Confirmación Inline de Items

**Concepto:** A medida que el usuario dicta, el asistente confirma items en tiempo real

**Implementación:**

1. **Parsing ligero en streaming:**

   ```typescript
   // En el system prompt, instruir al asistente a confirmar
   // con formato estructurado

   "Cuando el usuario mencione productos, confirma con formato:
    ✅ [cantidad] [unidad] de [producto]

    Ejemplo: '✅ 3 kg de Tomate'"
   ```

2. **Detección de items en respuesta:**

   ```typescript
   // En OrderChatContext, detectar pattern ✅ en respuestas
   const extractConfirmedItems = (message: string) => {
     const itemPattern = /✅\s+([\d.]+)\s+(\w+)\s+de\s+(.+)/g;
     const items: ConfirmedItem[] = [];

     let match;
     while ((match = itemPattern.exec(message)) !== null) {
       items.push({
         quantity: parseFloat(match[1]),
         unit: match[2],
         product: match[3],
       });
     }

     return items;
   };
   ```

3. **Mostrar preview de items:**
   ```typescript
   // Componente lateral que muestra items confirmados
   <OrderPreview items={confirmedItems} />
   ```

**Archivos afectados:**

- `/src/context/OrderChatContext.tsx`
- Nuevo: `/src/features/orders/components/OrderPreview.tsx`
- `/src/app/api/chat/route.ts` (actualizar system prompt)

---

#### Tarea 3.2: Productos Frecuentes y Sugerencias

**Archivo:** Nuevo `/src/features/orders/server/services/product-suggestions.ts`

**Implementación:**

1. **Analizar pedidos anteriores:**

   ```typescript
   export async function getFrequentProducts(userId: string, orgId: string) {
     const { data } = await supabase
       .from('order_items')
       .select('product, unit, quantity, orders!inner(created_by)')
       .eq('orders.created_by', userId)
       .eq('orders.organization_id', orgId)
       .gte('orders.created_at', thirtyDaysAgo);

     // Agrupar y contar
     const frequency = data.reduce((acc, item) => {
       const key = `${item.product}-${item.unit}`;
       acc[key] = (acc[key] || 0) + 1;
       return acc;
     }, {});

     // Top 10
     return Object.entries(frequency)
       .sort(([, a], [, b]) => b - a)
       .slice(0, 10);
   }
   ```

2. **Agregar al contexto del chat:**

   ```typescript
   // En /api/chat, agregar a system prompt:
   const frequentProducts = await getFrequentProducts(userId, orgId);

   const context = `
   PRODUCTOS FRECUENTES DEL USUARIO:
   ${frequentProducts.map(([p, count]) => `- ${p} (${count} veces)`).join('\n')}
   
   Si el usuario dice "mis productos habituales" o "lo de siempre",
   menciona estos productos.
   `;
   ```

**Archivos afectados:**

- Nuevo: `/src/features/orders/server/services/product-suggestions.ts`
- `/src/app/api/chat/route.ts`

---

#### Tarea 3.3: Manejo de Aclaraciones

**Concepto:** Si el usuario dice algo ambiguo, el asistente pregunta

**Ejemplos de aclaraciones:**

- Usuario: "Dame tomates" → Asistente: "¿Cuántos kg de tomate?"
- Usuario: "Poneme 5 de queso" → Asistente: "¿5 kg o 5 unidades de queso?"
- Usuario: "Lo mismo que la vez pasada" → Asistente: "Tu último pedido incluyó: ... ¿Quieres repetirlo?"

**Implementación:**

1. **Mejorar system prompt** con instrucciones de aclaración
2. **Contexto de último pedido:**
   ```typescript
   const lastOrder = await getLastOrder(userId, orgId);
   const lastOrderContext = lastOrder ? `ÚLTIMO PEDIDO: ${formatOrder(lastOrder)}` : '';
   ```

**Archivos afectados:**

- `/src/app/api/chat/route.ts`
- `/src/lib/ai/prompts.ts`

---

### FASE 4: Optimizaciones y Pulido

**Duración estimada:** Refinamiento final

#### Tarea 4.1: Optimizar Llamadas a IA

**Estrategia de caching:**

1. **Cache de system prompt:**
   - Gemini 2.0 soporta prompt caching
   - Cachear proveedores y productos frecuentes

2. **Reducir tokens:**
   - Limitar historial a últimos 15 mensajes
   - Resumir conversaciones largas

**Implementación:**

```typescript
// En /api/chat
const systemPrompt = {
  role: 'system',
  content: CONVERSATIONAL_SYSTEM_PROMPT,
  cacheControl: { type: 'ephemeral' }, // Prompt caching
};
```

**Archivos afectados:**

- `/src/app/api/chat/route.ts`

---

#### Tarea 4.2: Métricas y Analytics

**Tracking de eventos:**

```typescript
// Eventos a trackear:
-MESSAGE_SENT(user / assistant) -
  CHAT_SESSION_STARTED -
  CHAT_SESSION_ENDED -
  ORDER_PROCESSED -
  PARSING_SUCCESS / FAILURE -
  AVERAGE_RESPONSE_TIME;
```

**Integración con EventBus existente:**

```typescript
// En OrderChatContext
eventBus.emit({
  type: 'MESSAGE_SENT',
  payload: {
    orderId,
    role: 'user',
    messageLength: content.length,
    timestamp: new Date(),
  },
});
```

**Archivos afectados:**

- `/src/context/OrderChatContext.tsx`
- `/src/lib/events.ts` (ya existe)

---

#### Tarea 4.3: Tests y Validación

**Tests a implementar:**

1. **Unit tests:**
   - `parseOrderText` con casos edge
   - `extractConfirmedItems` regex
   - Sync logic

2. **Integration tests:**
   - Flujo completo de conversación
   - Audio → transcripción → respuesta
   - Offline → sync → online

3. **E2E tests (opcional):**
   - Crear pedido completo
   - Audio + texto mezclado
   - Procesamiento final

**Archivos nuevos:**

- `/src/features/orders/__tests__/chat-flow.test.ts`
- `/src/lib/ai/__tests__/parsing.test.ts`

---

## 4. CAMBIOS TÉCNICOS ESPECÍFICOS

### 4.1 Modificaciones en Context

**Antes (actual):**

```typescript
// OrderChatContext.tsx
const handleSubmit = async (content: string) => {
  await addMessage(content, 'user');
  scheduleAIResponse(); // Debounce 5s
};
```

**Después (propuesto):**

```typescript
// OrderChatContext.tsx
const handleSubmit = async (content: string) => {
  await addMessage(content, 'user');

  // Respuesta inmediata streaming
  await streamChatResponse(content);
};

const processFinalOrder = async () => {
  // Solo cuando user hace clic en "Procesar"
  await processBatchMessages(orderId);
};
```

### 4.2 Nuevos Hooks

**Hook 1: useStreamingChat**

```typescript
// /src/features/orders/hooks/useStreamingChat.ts
export function useStreamingChat(orderId: string) {
  const [isStreaming, setIsStreaming] = useState(false);

  const sendMessage = async (content: string) => {
    setIsStreaming(true);

    const response = await fetch('/api/chat', {
      method: 'POST',
      body: JSON.stringify({ orderId, message: content }),
    });

    // Leer stream...

    setIsStreaming(false);
  };

  return { sendMessage, isStreaming };
}
```

**Hook 2: useConfirmedItems**

```typescript
// /src/features/orders/hooks/useConfirmedItems.ts
export function useConfirmedItems() {
  const [items, setItems] = useState<ConfirmedItem[]>([]);

  const addConfirmedItem = (item: ConfirmedItem) => {
    setItems(prev => [...prev, item]);
  };

  return { confirmedItems: items, addConfirmedItem };
}
```

### 4.3 Estructura de System Prompts

**Archivo:** `/src/lib/ai/prompts.ts`

```typescript
export const PROMPTS = {
  CONVERSATIONAL: `...`, // Para chat streaming
  PARSING: `...`, // Para extraer JSON (actual)
  CLARIFICATION: `...`, // Para casos ambiguos
};

export function buildChatSystemPrompt(context: ChatContext) {
  return `
    ${PROMPTS.CONVERSATIONAL}

    CONTEXTO DEL USUARIO:
    ${context.suppliers ? `Proveedores: ${context.suppliers}` : ''}
    ${context.frequentProducts ? `Productos frecuentes: ${context.frequentProducts}` : ''}
    ${context.lastOrder ? `Último pedido: ${context.lastOrder}` : ''}
  `;
}
```

---

## 5. MEJORAS DE UX DETALLADAS

### 5.1 Estados Visuales

| Estado              | Indicador Visual              | Ubicación                   |
| ------------------- | ----------------------------- | --------------------------- |
| Usuario escribiendo | "Usuario está escribiendo..." | Arriba del input (opcional) |
| Asistente pensando  | Typing indicator animado      | MessageList                 |
| Sincronizando       | Badge "Sincronizando..."      | Header                      |
| Offline             | Badge rojo "Sin conexión"     | Header                      |
| Procesando pedido   | Progress bar + texto          | Modal overlay               |

### 5.2 Mejoras en ChatInput

**Características a agregar:**

1. **Auto-resize del textarea** (ya existe, validar)
2. **Teclado virtual optimizado** (mobile)
3. **Shortcuts:**
   - Enter: Enviar mensaje
   - Shift+Enter: Nueva línea
   - Ctrl+K: Limpiar input
4. **Comando de voz mejorado:**
   - Botón más grande
   - Feedback visual al grabar
   - Countdown timer

### 5.3 Diseño Responsive

**Mobile-first considerations:**

- Mensajes más compactos en móvil
- Quick replies en horizontal scroll
- Botón flotante para "Procesar pedido"
- Input fijo en bottom (sticky)

---

## 6. CONSIDERACIONES DE COSTOS

### 6.1 Estimación de Costos de API

**Gemini 2.0 Flash (actual):**

- Input: $0.075 / 1M tokens
- Output: $0.30 / 1M tokens

**Escenario típico:**

**Conversación (nuevo):**

- System prompt: ~500 tokens (cacheado)
- Historial (15 msgs): ~1,500 tokens
- Respuesta: ~50 tokens
- **Costo por mensaje:** ~$0.0001 USD

**Parsing (actual):**

- System prompt: ~800 tokens
- Conversación completa: ~2,000 tokens
- JSON output: ~300 tokens
- **Costo por pedido:** ~$0.0008 USD

**Total por pedido:** ~$0.001 - $0.002 USD (depende de largo de conversación)

### 6.2 Optimizaciones de Costo

1. **Prompt caching:** Reduce 50% de tokens en system prompt
2. **Limitar historial:** Máximo 15 mensajes (vs. ilimitado)
3. **Temperatura baja en parsing:** Menos regeneraciones
4. **Groq para audio:** Gratuito (Whisper)

---

## 7. RIESGOS Y MITIGACIONES

| Riesgo                                    | Impacto | Probabilidad | Mitigación                                                                                                           |
| ----------------------------------------- | ------- | ------------ | -------------------------------------------------------------------------------------------------------------------- |
| Latencia en respuestas streaming          | Alto    | Media        | • Usar Gemini 2.0 Flash (más rápido)<br>• Implementar timeout de 30s<br>• Fallback a respuesta estática              |
| Conversación se desvía del tema           | Medio   | Alta         | • System prompt estricto<br>• Detectar off-topic y redirigir<br>• Límite de mensajes sin items                       |
| Usuario confundido con modo dual          | Alto    | Media        | • UI clara para "Procesar pedido"<br>• Onboarding tutorial<br>• Mensajes explicativos                                |
| Errores de parsing en modo conversacional | Medio   | Media        | • Modo parsing sigue siendo el definitivo<br>• Confirmaciones inline son preview<br>• Usuario revisa antes de enviar |
| Costos de API se disparan                 | Alto    | Baja         | • Rate limiting por usuario<br>• Monitoring de costos<br>• Alertas en dashboard                                      |
| Sincronización falla con streaming        | Alto    | Baja         | • Mantener IndexedDB como source of truth<br>• Retry logic robusto<br>• Validar estado antes de procesar             |
| Conflictos de sync al volver online       | Medio   | Baja         | • La fuente de verdad es el orden cronológico local<br>• Servidor acepta timestamp del cliente                       |
| Usuario cierra app antes de sync          | Alto    | Media        | • Service Workers para background sync (avanzado)<br>• Advertencia "Cambios sin guardar" al intentar cerrar          |

---

## 8. MÉTRICAS DE ÉXITO

### KPIs Principales

1. **Tiempo de respuesta del asistente:**
   - **Objetivo:** < 2 segundos para primera palabra
   - **Medición:** Timestamp entre mensaje user y primer chunk

2. **Satisfacción del usuario:**
   - **Objetivo:** > 80% de pedidos completados sin edición manual
   - **Medición:** Comparar items iniciales vs. items finales en review

3. **Mensajes por pedido:**
   - **Objetivo:** < 10 mensajes en promedio
   - **Medición:** Count de mensajes por order_id

4. **Tasa de abandono:**
   - **Objetivo:** < 15% de chats sin completar
   - **Medición:** Chats iniciados vs. pedidos enviados

5. **Accuracy de parsing:**
   - **Objetivo:** > 90% de items correctos sin edición
   - **Medición:** Confidence score promedio > 0.85

### Métricas Secundarias

- Uso de audio vs. texto
- Quick replies más clickeadas
- Tiempo total por pedido
- Número de aclaraciones necesarias
- Tasa de error en transcripción

---

## 9. CRONOGRAMA SUGERIDO

### Sprint 1 (Fundación)

- ✅ Análisis completo (completado)
- Tarea 1.1: Actualizar OrderChatContext
- Tarea 1.2: Mejorar API de chat streaming
- Tarea 1.3: Typing indicator

**Entregable:** Chat básico con respuestas inmediatas

### Sprint 2 (UX)

- Tarea 2.1: Rediseñar message bubbles
- Tarea 2.2: Quick replies
- Tarea 2.3: Progress indicator

**Entregable:** Chat con mejor feedback visual

### Sprint 3 (Inteligencia)

- Tarea 3.1: Confirmación inline
- Tarea 3.2: Productos frecuentes
- Tarea 3.3: Manejo de aclaraciones

**Entregable:** Chat con contexto inteligente

### Sprint 4 (Optimización)

- Tarea 4.1: Optimizar llamadas IA
- Tarea 4.2: Métricas
- Tarea 4.3: Tests

**Entregable:** Sistema robusto y monitoreado

---

## 10. CHECKLIST DE IMPLEMENTACIÓN

### Pre-requisitos

- [ ] Validar que `GEMINI_API_KEY` esté configurada
- [ ] Verificar que endpoint `/api/chat` funciona standalone
- [ ] Backup de base de datos antes de cambios
- [ ] Crear rama feature: `feature/conversational-chat`

### FASE 1

- [ ] Eliminar/comentar debouncing en `OrderChatContext`
- [ ] Implementar `sendMessageImmediate()` con streaming
- [ ] Actualizar system prompt en `/api/chat`
- [ ] Crear `TypingIndicator` component
- [ ] Integrar typing indicator en `MessageList`
- [ ] Integrar typing indicator en `MessageList`
- [ ] Probar flujo básico: mensaje → respuesta streaming
- [ ] Implementar `useNetworkStatus`
- [ ] Agregar lógica de encolado offline en `OrderChatContext`
- [ ] Implementar mecanismo de auto-sync al reconectar

### FASE 2

- [ ] Rediseñar `MessageBubble` con avatares y mejor diseño
- [ ] Crear `QuickReplies` component
- [ ] Integrar quick replies en `OrderChatInterface`
- [ ] Mejorar `ProcessButton` con progress indicator
- [ ] Agregar animaciones con Framer Motion
- [ ] Testing en mobile

### FASE 3

- [ ] Implementar `extractConfirmedItems()` logic
- [ ] Crear `OrderPreview` component lateral
- [ ] Implementar `getFrequentProducts()` service
- [ ] Agregar productos frecuentes al system prompt
- [ ] Agregar contexto de último pedido
- [ ] Implementar lógica de aclaraciones en prompt

### FASE 4

- [ ] Implementar prompt caching
- [ ] Limitar historial a 15 mensajes
- [ ] Agregar event tracking completo
- [ ] Crear dashboard de métricas (opcional)
- [ ] Escribir tests unitarios
- [ ] Escribir tests de integración
- [ ] Documentación de API

### Post-implementación

- [ ] Monitoring de costos de API
- [ ] Análisis de métricas de KPIs
- [ ] Feedback de usuarios beta
- [ ] Ajustes de prompts basados en uso real
- [ ] Optimizaciones de performance

---

## 11. COMANDOS ÚTILES

### Desarrollo

```bash
# Levantar proyecto
npm run dev

# Ejecutar tests
npm run test

# Type checking
npm run type-check

# Linter
npm run lint
```

### Base de datos

```bash
# Crear nueva migración
npx supabase migration new <nombre>

# Aplicar migraciones
npx supabase db push

# Reset local
npx supabase db reset
```

### Monitoreo

```bash
# Ver logs de API
vercel logs

# Monitorear costos de Gemini
# (Ver Google Cloud Console)
```

---

## 12. RECURSOS Y REFERENCIAS

### Documentación

- [Gemini API Docs](https://ai.google.dev/docs)
- [Vercel AI SDK](https://sdk.vercel.ai/docs)
- [Supabase Realtime](https://supabase.com/docs/guides/realtime)

### Arquitectura actual

- `/src/context/OrderChatContext.tsx` - Context principal
- `/src/app/api/chat/route.ts` - Endpoint streaming (no usado)
- `/src/lib/ai/gemini.ts` - Integración Gemini
- `/src/features/orders/hooks/useDebouncedAIResponse.ts` - Debouncing actual

### System prompts

- Conversacional: `/src/lib/ai/prompts.ts` (crear)
- Parsing: `/src/lib/ai/gemini.ts:82` (actual)

---

## 13. NOTAS FINALES

### Lo más importante

1. **El modo dual es clave:** Conversación fluida + parsing robusto final
2. **No romper lo que funciona:** El sistema de parsing actual es bueno, solo agregar capa conversacional
3. **Offline-first:** Mantener IndexedDB como source of truth
4. **Mobile-first:** La mayoría de usuarios estarán en móvil
5. **Costos controlados:** Monitoring constante de uso de API

### Lo que NO hacer

❌ No eliminar el sistema actual de parsing
❌ No hacer llamadas a IA síncronas (siempre async)
❌ No guardar API keys en frontend
❌ No asumir que el internet siempre está disponible
❌ No sobre-ingenierizar: empezar simple, iterar después

### Próximos pasos inmediatos

1. ✅ **Revisar este plan con el equipo**
2. **Validar enfoque técnico:** ¿Gemini 2.0 Flash es suficiente?
3. **Priorizar fases:** ¿Empezamos con FASE 1 completa o MVP reducido?
4. **Asignar recursos:** ¿Quién implementa qué?
5. **Definir timeline:** ¿Cuándo queremos tener MVP en producción?

---

**Preparado por:** Claude (Anthropic)
**Fecha:** 1 de Diciembre, 2025
**Versión:** 1.0
**Estado:** Pendiente de revisión y aprobación

---

## APÉNDICE A: Ejemplo de Conversación Real

```
[13:45] Usuario: "Hola"
[13:45] Asistente: "¡Hola! ¿Qué productos necesitas para tu pedido?"

[13:46] Usuario: [🎤 Graba audio: "necesito tres kilos de tomate, medio kilo de cebolla y dos kilos de papa"]
[13:46] Asistente: "Perfecto, anotado:
                     • 3 kg de Tomate
                     • 0.5 kg de Cebolla
                     • 2 kg de Papa
                     ¿Algo más?"

[13:47] Usuario: "sí, poneme lo mismo de siempre de lácteos"
[13:47] Asistente: "Tu pedido habitual de lácteos incluye:
                     • 2 L de Leche
                     • 1 kg de Queso
                     • 12 Huevos
                     ¿Quieres todo eso?"

[13:48] Usuario: "dale pero poneme 3 de queso"
[13:48] Asistente: "Listo, actualizado:
                     • 2 L de Leche
                     • 3 kg de Queso ✅
                     • 12 Huevos
                     ¿Necesitas algo más?"

[13:49] Usuario: "eso es todo"
[13:49] Asistente: "Perfecto. Cuando quieras puedes procesar el pedido para revisarlo antes de enviar."

[Quick Reply: "Procesar Pedido"]

[13:50] Usuario: [Click "Procesar Pedido"]
[13:50] Sistema: "🔄 Procesando tu pedido..."

[13:51] Asistente: "✅ Pedido procesado. Encontré 6 productos:

                     VERDULERÍA LÓPEZ:
                     • 3 kg de Tomate
                     • 0.5 kg de Cebolla
                     • 2 kg de Papa

                     LÁCTEOS SAN JUAN:
                     • 2 L de Leche
                     • 3 kg de Queso
                     • 12 units de Huevos

                     [Botón: Revisar Pedido]"
```

---

## APÉNDICE B: Diagramas de Flujo

### Flujo de Mensaje (Nuevo)

```
┌──────────────────┐
│ Usuario escribe  │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Guardar en       │
│ IndexedDB        │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Sincronizar a    │
│ Supabase         │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Llamar API       │
│ /api/chat        │
│ (streaming)      │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Mostrar typing   │
│ indicator        │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Stream respuesta │
│ palabra por      │
│ palabra          │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Guardar mensaje  │
│ asistente en DB  │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Extraer items    │
│ confirmados      │
│ (opcional)       │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Actualizar       │
│ OrderPreview     │
└──────────────────┘
```

### Flujo de Procesamiento Final (Sin cambios)

```
┌──────────────────┐
│ Click "Procesar" │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Sincronizar      │
│ mensajes         │
│ pendientes       │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Fetch todos los  │
│ mensajes user    │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Concatenar texto │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ parseOrderText() │
│ con Gemini       │
│ (modo parsing)   │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Validar y        │
│ clasificar items │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Guardar en       │
│ order_items      │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Redirect a       │
│ /review          │
└──────────────────┘
```

---

**FIN DEL PLAN**
