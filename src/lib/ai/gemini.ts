import { GoogleGenerativeAI } from '@google/generative-ai';
import { z } from 'zod';

if (!process.env.GEMINI_API_KEY) {
  console.warn('Missing GEMINI_API_KEY environment variable');
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const model = genAI.getGenerativeModel({
  model: 'models/gemini-1.5-flash',
  generationConfig: {
    temperature: 0.1, // Low temperature for deterministic parsing
    responseMimeType: 'application/json',
  },
});

// Valid units and categories
const validUnits = ['kg', 'g', 'units', 'dozen', 'liters', 'ml', 'packages', 'boxes'] as const;
const validCategories = [
  'fruits_vegetables',
  'meats',
  'fish_seafood',
  'dry_goods',
  'dairy',
  'beverages',
] as const;

// Schema for parsed items with graceful error handling
export const ParsedItemSchema = z.object({
  product: z.string(),
  quantity: z.number(),
  unit: z
    .union([z.enum(['kg', 'g', 'units', 'dozen', 'liters', 'ml', 'packages', 'boxes']), z.string()])
    .transform(val => {
      // Validate and sanitize unit, defaulting to 'units' if invalid
      if (typeof val !== 'string') return 'units';
      if (validUnits.includes(val as (typeof validUnits)[number])) {
        return val as (typeof validUnits)[number];
      }
      console.warn('[Gemini] Invalid unit received:', val, '- defaulting to "units"');
      return 'units';
    }),
  category: z
    .union([
      z.enum(['fruits_vegetables', 'meats', 'fish_seafood', 'dry_goods', 'dairy', 'beverages']),
      z.string(),
      z.null(),
      z.undefined(),
    ])
    .optional()
    .transform(val => {
      // Validate and sanitize category
      if (!val || typeof val !== 'string') return undefined;
      if (validCategories.includes(val as (typeof validCategories)[number])) {
        return val as (typeof validCategories)[number];
      }
      console.warn('[Gemini] Invalid category received:', val, '- setting to undefined');
      return undefined;
    }),
  confidence: z.number().min(0).max(1),
  original_text: z.string().optional(),
  supplier_id: z.string().nullable().optional(),
  supplier_name: z.string().nullable().optional(),
});

export type ParsedItem = z.infer<typeof ParsedItemSchema>;

export const ParseResultSchema = z.object({
  items: z.array(ParsedItemSchema),
});

/**
 * Supplier type for classification context
 */
export interface SupplierContext {
  id: string;
  name: string;
  category: string | null;
  custom_keywords: string[] | null;
}

/**
 * Parse natural language order text into structured items using Gemini
 * with supplier context for intelligent classification
 */
export async function parseOrderText(
  text: string,
  suppliers: SupplierContext[] = []
): Promise<ParsedItem[]> {
  return withRetry(async () => {
    try {
      // Build supplier context for prompt
      const supplierContext =
        suppliers.length > 0
          ? `\n\nProveedores disponibles:\n${suppliers
              .map(
                s =>
                  `- ID: ${s.id}\n  Nombre: ${s.name}\n  Categoría: ${s.category || 'sin categoría'}\n  Keywords: [${s.custom_keywords?.join(', ') || 'ninguna'}]`
              )
              .join('\n')}\n`
          : '';

      const prompt = `
                Eres un asistente experto en gestión de pedidos para restaurantes.
                Tu tarea es extraer una lista estructurada de productos, cantidades y unidades del siguiente texto de un pedido,
                Y ADEMÁS asignar cada item al proveedor más apropiado.
                ${supplierContext}
                Texto del pedido: "${text}"

                Reglas de extracción:
                1. Identifica cada producto individual.
                2. Extrae la cantidad numérica. Convierte texto a números (ej: "media docena" -> 6, "un par" -> 2, "kilo y medio" -> 1.5).
                3. Asigna la unidad más apropiada de esta lista: ['kg', 'g', 'units', 'dozen', 'liters', 'ml', 'packages', 'boxes'].
                - Si no se especifica unidad, usa 'units'.
                - "atado", "manojo", "unidad" -> 'units'
                - "botella", "litro" -> 'liters'
                4. Intenta inferir la categoría del producto de esta lista: ['fruits_vegetables', 'meats', 'fish_seafood', 'dry_goods', 'dairy', 'beverages'].
                5. Asigna un nivel de confianza (0.0 a 1.0) basado en qué tan claro es el pedido.
                ${
                  suppliers.length > 0
                    ? `6. IMPORTANTE: Asigna cada item al proveedor más apropiado considerando:
                - La categoría del proveedor debe coincidir con el tipo de producto
                - Las keywords del proveedor pueden indicar productos específicos que vende
                - Si ningún proveedor es apropiado, deja supplier_id como null
                - Incluye el nombre del proveedor asignado en supplier_name`
                    : ''
                }

                Responde SOLO con un objeto JSON con la siguiente estructura:
                {
                "items": [
                    {
                    "product": "nombre del producto normalizado (ej: 'Tomate Perita')",
                    "quantity": 2.5,
                    "unit": "kg",
                    "category": "fruits_vegetables",
                    "confidence": 0.95,
                    "original_text": "texto original del item (ej: 'dos kilos y medio de tomate')",
                    ${
                      suppliers.length > 0
                        ? `"supplier_id": "id del proveedor asignado o null",
                    "supplier_name": "nombre del proveedor asignado o null"`
                        : ''
                    }
                    }
                ]
                }
            `;

      const result = await model.generateContent(prompt);
      const response = result.response;
      const textResponse = response.text();

      // Parse JSON response
      const jsonResponse = JSON.parse(textResponse);

      // Debug: Log the raw response

      // Validate with Zod
      try {
        const parsed = ParseResultSchema.parse(jsonResponse);
        return parsed.items;
      } catch (zodError) {
        console.error('[Gemini] Zod validation failed');
        console.error('[Gemini] Raw response:', JSON.stringify(jsonResponse, null, 2));
        console.error('[Gemini] Zod error:', zodError);
        throw zodError;
      }
    } catch (error) {
      console.error('Gemini parsing error:', error);
      throw error;
    }
  });
}

/**
 * Retry helper with exponential backoff
 */
async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3, baseDelay = 1000): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      // Don't retry on quota exceeded or validation errors
      if (
        error?.status === 429 ||
        error?.message?.includes('429') ||
        error?.message?.includes('quota') ||
        error instanceof z.ZodError
      ) {
        throw error;
      }

      if (i === maxRetries - 1) throw error;

      const delay = baseDelay * Math.pow(2, i);
      console.warn(`Retrying Gemini request (attempt ${i + 1}/${maxRetries}) in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw new Error('Max retries exceeded');
}
