import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ParsedItemSchema, ParseResultSchema } from './gemini';
import type { SupplierContext } from './gemini';

// Mock de Google Generative AI
const mockGenerateContent = vi.fn();
const mockGetGenerativeModel = vi.fn(() => ({
  generateContent: mockGenerateContent,
}));

vi.mock('@google/generative-ai', () => {
  return {
    GoogleGenerativeAI: class {
      getGenerativeModel = mockGetGenerativeModel;
    },
  };
});

describe('Gemini AI - Order Parsing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('ParsedItemSchema', () => {
    it('should validate a correct parsed item', () => {
      const validItem = {
        product: 'Tomate',
        quantity: 2.5,
        unit: 'kg',
        category: 'fruits_vegetables',
        confidence: 0.95,
        original_text: 'dos kilos y medio de tomate',
        supplier_id: 'supplier-123',
        supplier_name: 'Verdulería Central',
      };

      const result = ParsedItemSchema.safeParse(validItem);
      expect(result.success).toBe(true);
    });

    it('should reject invalid unit', () => {
      const invalidItem = {
        product: 'Tomate',
        quantity: 2.5,
        unit: 'invalid_unit', // Unit inválida
        confidence: 0.95,
      };

      const result = ParsedItemSchema.safeParse(invalidItem);
      expect(result.success).toBe(false);
    });

    it('should reject confidence out of range', () => {
      const invalidItem = {
        product: 'Tomate',
        quantity: 2.5,
        unit: 'kg',
        confidence: 1.5, // Fuera de rango 0-1
      };

      const result = ParsedItemSchema.safeParse(invalidItem);
      expect(result.success).toBe(false);
    });

    it('should accept null supplier_id', () => {
      const itemWithoutSupplier = {
        product: 'Tomate',
        quantity: 2.5,
        unit: 'kg',
        confidence: 0.95,
        supplier_id: null,
      };

      const result = ParsedItemSchema.safeParse(itemWithoutSupplier);
      expect(result.success).toBe(true);
    });
  });

  describe('ParseResultSchema', () => {
    it('should validate array of items', () => {
      const validResult = {
        items: [
          {
            product: 'Tomate',
            quantity: 2.5,
            unit: 'kg',
            confidence: 0.95,
          },
          {
            product: 'Cebolla',
            quantity: 1,
            unit: 'kg',
            confidence: 0.9,
          },
        ],
      };

      const result = ParseResultSchema.safeParse(validResult);
      expect(result.success).toBe(true);
    });

    it('should reject if items array contains invalid item', () => {
      const invalidResult = {
        items: [
          {
            product: 'Tomate',
            quantity: 2.5,
            unit: 'invalid_unit',
            confidence: 0.95,
          },
        ],
      };

      const result = ParseResultSchema.safeParse(invalidResult);
      expect(result.success).toBe(false);
    });
  });

  describe('parseOrderText', () => {
    it('should parse simple order text', async () => {
      mockGenerateContent.mockResolvedValue({
        response: {
          text: () =>
            JSON.stringify({
              items: [
                {
                  product: 'Tomate Perita',
                  quantity: 2.5,
                  unit: 'kg',
                  confidence: 0.95,
                  original_text: 'dos kilos y medio de tomate',
                },
              ],
            }),
        },
      });

      const { parseOrderText } = await import('./gemini');
      const result = await parseOrderText('necesito dos kilos y medio de tomate');

      expect(result).toHaveLength(1);
      expect(result[0]).toBeDefined();
      expect(result[0]!.product).toBe('Tomate Perita');
      expect(result[0]!.quantity).toBe(2.5);
      expect(result[0]!.unit).toBe('kg');
    });

    it('should handle supplier context', async () => {
      mockGenerateContent.mockResolvedValue({
        response: {
          text: () =>
            JSON.stringify({
              items: [
                {
                  product: 'Tomate Perita',
                  quantity: 2.5,
                  unit: 'kg',
                  confidence: 0.95,
                  supplier_id: 'supplier-123',
                  supplier_name: 'Verdulería Central',
                },
              ],
            }),
        },
      });

      const suppliers: SupplierContext[] = [
        {
          id: 'supplier-123',
          name: 'Verdulería Central',
          category: 'fruits_vegetables',
          custom_keywords: ['tomate', 'verduras'],
        },
      ];

      const { parseOrderText } = await import('./gemini');
      const result = await parseOrderText('necesito dos kilos y medio de tomate', suppliers);

      expect(result).toHaveLength(1);
      expect(result[0]).toBeDefined();
      expect(result[0]!.supplier_id).toBe('supplier-123');
      expect(result[0]!.supplier_name).toBe('Verdulería Central');
    });

    it('should retry on failure', async () => {
      mockGenerateContent.mockRejectedValueOnce(new Error('API Error')).mockResolvedValueOnce({
        response: {
          text: () =>
            JSON.stringify({
              items: [
                {
                  product: 'Tomate',
                  quantity: 1,
                  unit: 'kg',
                  confidence: 0.9,
                },
              ],
            }),
        },
      });

      const { parseOrderText } = await import('./gemini');
      const result = await parseOrderText('un kilo de tomate');

      expect(result).toHaveLength(1);
      expect(mockGenerateContent).toHaveBeenCalledTimes(2);
    });

    it('should throw after max retries', async () => {
      mockGenerateContent.mockRejectedValue(new Error('API Error'));

      const { parseOrderText } = await import('./gemini');
      await expect(parseOrderText('un kilo de tomate')).rejects.toThrow('API Error');
      expect(mockGenerateContent).toHaveBeenCalledTimes(3); // 3 intentos
    });

    it('should handle empty response', async () => {
      mockGenerateContent.mockResolvedValue({
        response: {
          text: () => JSON.stringify({ items: [] }),
        },
      });

      const { parseOrderText } = await import('./gemini');
      const result = await parseOrderText('texto sin productos válidos');

      expect(result).toHaveLength(0);
    });

    it('should handle multiple items', async () => {
      mockGenerateContent.mockResolvedValue({
        response: {
          text: () =>
            JSON.stringify({
              items: [
                {
                  product: 'Tomate',
                  quantity: 2,
                  unit: 'kg',
                  confidence: 0.95,
                },
                {
                  product: 'Cebolla',
                  quantity: 1.5,
                  unit: 'kg',
                  confidence: 0.9,
                },
                {
                  product: 'Lechuga',
                  quantity: 3,
                  unit: 'units',
                  confidence: 0.85,
                },
              ],
            }),
        },
      });

      const { parseOrderText } = await import('./gemini');
      const result = await parseOrderText(
        'dos kilos de tomate, kilo y medio de cebolla, y tres lechugas'
      );

      expect(result).toHaveLength(3);
      expect(result[0]).toBeDefined();
      expect(result[1]).toBeDefined();
      expect(result[2]).toBeDefined();
      expect(result[0]!.product).toBe('Tomate');
      expect(result[1]!.product).toBe('Cebolla');
      expect(result[2]!.product).toBe('Lechuga');
    });
  });

  describe('Unit parsing', () => {
    it('should parse different units correctly', async () => {
      mockGenerateContent.mockResolvedValue({
        response: {
          text: () =>
            JSON.stringify({
              items: [
                { product: 'Tomate', quantity: 2, unit: 'kg', confidence: 0.9 },
                { product: 'Sal', quantity: 500, unit: 'g', confidence: 0.9 },
                { product: 'Huevos', quantity: 12, unit: 'units', confidence: 0.95 },
                { product: 'Leche', quantity: 2, unit: 'liters', confidence: 0.9 },
              ],
            }),
        },
      });

      const { parseOrderText } = await import('./gemini');
      const result = await parseOrderText('2kg tomate, 500g sal, 12 huevos, 2 litros leche');

      expect(result).toHaveLength(4);
      expect(result[0]).toBeDefined();
      expect(result[1]).toBeDefined();
      expect(result[2]).toBeDefined();
      expect(result[3]).toBeDefined();
      expect(result[0]!.unit).toBe('kg');
      expect(result[1]!.unit).toBe('g');
      expect(result[2]!.unit).toBe('units');
      expect(result[3]!.unit).toBe('liters');
    });
  });
});
