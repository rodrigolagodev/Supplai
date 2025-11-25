import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import { LocalOrder } from '@/lib/db/schema';

export function useLocalOrder(orderId?: string) {
  const order = useLiveQuery(async () => {
    if (!orderId) return null;
    return db.orders.get(orderId);
  }, [orderId]);

  const createOrder = async (organizationId: string) => {
    const newOrderId = uuidv4();
    const newOrder: LocalOrder = {
      id: newOrderId,
      organization_id: organizationId,
      status: 'draft',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      sync_status: 'pending',
    };

    await db.orders.add(newOrder);
    return newOrderId;
  };

  const updateStatus = async (status: LocalOrder['status']) => {
    if (!orderId) return;
    await db.orders.update(orderId, {
      status,
      updated_at: new Date().toISOString(),
      sync_status: 'pending',
    });
  };

  return {
    order,
    createOrder,
    updateStatus,
    isLoading: order === undefined,
  };
}
