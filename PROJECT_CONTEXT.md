# Pedidos - Contexto del Proyecto

## Resumen Ejecutivo

Aplicación web que automatiza la gestión y envío de pedidos a proveedores en locales gastronómicos mediante entrada por voz/texto y clasificación automática con AI.

---

## El Problema

### Situación actual

Al finalizar el servicio, el jefe de cocina debe:

1. Recorrer físicamente el local (cámara de frío, heladeras, congelador, almacén, despensa)
2. Anotar faltantes en papel con lapicera o telefono
3. Sentarse a traspasar la lista manualmente al teléfono
4. Enviar mensajes individuales a cada proveedor por WhatsApp/email
5. Repetir este proceso cada día

### Pain points específicos

- **Momento crítico**: Se hace al final del día cuando hay cansancio
- **Ineficiencia**: Transcripción manual papel → digital
- **Fragmentación**: Múltiples conversaciones con múltiples proveedores
- **Condiciones adversas**: Anotar en cámara de frío con las manos ocupadas
- **Sin trazabilidad**: No hay historial centralizado de pedidos

---

## La Solución

### Propuesta de valor

Una app que permite al usuario dictar o escribir todo lo que necesita en un solo lugar, y el sistema automáticamente:

1. Transcribe los mensajes de voz
2. Extrae los items con cantidades y unidades
3. Clasifica cada item según el proveedor correspondiente
4. Genera listas separadas para revisión
5. Envía todo con un click al medio configurado de cada proveedor

### Flujo principal

```
[Voz/Texto] → [Transcripción] → [Parsing AI] → [Clasificación] → [Revisión humana] → [Envío]
```

---

## Características Clave

### Input flexible

- **Voz**: Mensajes de audio que se transcriben automáticamente
- **Texto**: Escritura directa si se prefiere
- **Mixto**: Combinación de ambos en la misma sesión

### Clasificación inteligente

- Cada proveedor tiene una **categoría** con vocabulario predefinido (frutas_verduras, carnes, secos, etc.)
- El usuario puede agregar **keywords personalizadas** por proveedor
- El AI aprende sinónimos y variaciones regionales (papa/patata)
- Items no clasificables se marcan para asignación manual

### Revisión obligatoria (Human-in-the-loop)

- Antes de enviar, el usuario ve todas las listas generadas
- Puede editar cantidades, mover items entre proveedores, eliminar
- Items sin clasificar requieren asignación manual
- **La responsabilidad final es del usuario**

### Envío automatizado

- Email (MVP - gratis)
- WhatsApp Business API (fase posterior - tiene costo)
- Telegram (opcional)
- Cada proveedor tiene su medio preferido configurado

### Historial y trazabilidad

- Registro de todos los pedidos enviados
- Filtros por fecha, proveedor, items
- Múltiples usuarios de la empresa pueden consultar
- Útil para control de stock, contabilidad, auditorías

---

## Decisiones de Diseño

### Scope definido (lo que SÍ hace)

- Transcribir voz a texto
- Parsear items de pedido (producto, cantidad, unidad)
- Clasificar items por proveedor
- Enviar mensajes formateados a proveedores
- Mantener historial de pedidos

### Scope excluido (lo que NO hace)

- Gestionar respuestas de proveedores
- Control de inventario/stock
- Gestión de precios o facturación
- Confirmaciones de pedidos recibidos
- Sugerencias de proveedores alternativos

### Principios

- **Unidireccional**: Solo envía, no gestiona conversaciones
- **Simplicidad**: Curva de aprendizaje casi cero
- **Confiabilidad**: Siempre revisión humana antes de enviar
- **Bajo costo**: MVP con tecnologías gratuitas o de bajo costo

---

## Modelo de Negocio

### Fase Beta (MVP)

- Gratuito
- Solo envío por email
- Validación de producto y usuarios

### Fase posterior

- Freemium o SaaS mensual
- Integración WhatsApp Business API
- Features premium (analytics, múltiples usuarios, etc.)

### Mercado objetivo

- Restaurantes independientes
- Cafeterías pequeñas
- Dark kitchens
- Cualquier negocio gastronómico que pida a proveedores regularmente

---

## Stack Tecnológico (Definitivo MVP)

| Componente      | Tecnología              | Justificación                                         |
| --------------- | ----------------------- | ----------------------------------------------------- |
| Frontend + API  | Next.js 16 (App Router) | Turbopack por defecto, React Compiler, todo integrado |
| Estilos         | Tailwind CSS 4          | Rápido para prototipar, buen ecosistema               |
| Hosting         | Vercel (free tier)      | Perfecto para Next.js, deploy automático              |
| Base de datos   | Supabase PostgreSQL     | Free tier generoso, integrado con Auth y Storage      |
| Autenticación   | Supabase Auth           | 50K MAU gratis, integrado con DB                      |
| Speech-to-Text  | Groq Whisper            | Gratis con rate limits, muy rápido                    |
| LLM Parsing     | Gemini 1.5 Flash        | Free tier generoso (60 req/min)                       |
| Email           | Resend                  | 3000 emails/mes gratis, API moderna                   |
| Storage (audio) | Supabase Storage        | Incluido en free tier                                 |
| WhatsApp        | Twilio (fase posterior) | API establecida, tiene costo por mensaje              |

### Requisitos del stack

- Node.js 20.9+
- TypeScript 5+

### Costos estimados

| Fase                           | Costo mensual  |
| ------------------------------ | -------------- |
| MVP (hasta ~100 usuarios)      | **$0**         |
| Crecimiento (100-500 usuarios) | $10-30         |
| WhatsApp integration           | +$0.05/mensaje |

### Alternativas si los free tiers no alcanzan

- Groq Whisper → OpenAI Whisper API ($0.006/min)
- Gemini Flash → GPT-4o-mini ($0.15/1M tokens)
- Supabase → Neon + Auth.js

---

## Riesgos Identificados

1. **Calidad de audio**: Ruido de cocina, cámara de frío, manos ocupadas
2. **Parsing de cantidades**: "Media docena", "un par", unidades ambiguas
3. **Adopción**: Convencer usuarios de cambiar su rutina establecida
4. **Vocabulario específico**: Términos culinarios, productos locales

---

## Métricas de Éxito (MVP)

- Tiempo de creación de pedido vs método tradicional
- Precisión de transcripción de voz
- Precisión de clasificación automática por proveedor
- Tasa de edición manual necesaria
- Retención de usuarios después de primera semana

---

## Estado Actual

**Fase**: Definición y planificación

**Próximos pasos por definir**:

- [ ] Modelo de datos detallado
- [ ] Diseño de UX/flujo de pantallas
- [ ] Prompt engineering para parsing
- [ ] Setup técnico inicial

---

_Última actualización: 2025-11-18_
