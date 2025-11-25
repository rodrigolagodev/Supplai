import { useState, useCallback, useRef } from 'react';
import { createDraftOrder } from '@/features/orders/actions/create-order';

/**
 * Hook to manage order lifecycle and prevent race conditions
 * during order creation.
 *
 * Problem solved:
 * - Multiple concurrent calls to ensureOrderExists() could create duplicate orders
 * - No single source of truth for order creation logic
 *
 * Solution:
 * - Uses a ref to track ongoing creation promise
 * - Returns the same promise for concurrent calls
 * - Prevents duplicate order creation
 *
 * @param organizationId - The organization ID for creating orders
 * @returns Object with orderId, ensureOrderExists function, and setOrderId
 */
export function useOrderLifecycle(organizationId: string) {
  const [orderId, setOrderId] = useState<string | null>(null);
  const creationPromiseRef = useRef<Promise<string> | null>(null);

  /**
   * Ensures an order exists, creating one if necessary.
   * Prevents race conditions by reusing the same creation promise
   * for concurrent calls.
   */
  const ensureOrderExists = useCallback(async (): Promise<string> => {
    // If order already exists, return it immediately
    if (orderId) {
      return orderId;
    }

    // If creation is already in progress, return the existing promise
    if (creationPromiseRef.current) {
      return creationPromiseRef.current;
    }

    // Start new order creation
    creationPromiseRef.current = createDraftOrder(organizationId)
      .then(order => {
        setOrderId(order.id);
        creationPromiseRef.current = null; // Clear ref after completion
        return order.id;
      })
      .catch(error => {
        creationPromiseRef.current = null; // Clear ref on error
        throw error;
      });

    return creationPromiseRef.current;
  }, [orderId, organizationId]);

  return {
    orderId,
    ensureOrderExists,
    setOrderId,
  };
}
