import Dexie, { Table } from 'dexie';
import { LocalOrder, LocalMessage, LocalOrderItem } from './schema';

export class AppDatabase extends Dexie {
  orders!: Table<LocalOrder>;
  messages!: Table<LocalMessage>;
  orderItems!: Table<LocalOrderItem>;

  constructor() {
    super('PedidosDB');

    this.version(1).stores({
      orders: 'id, organization_id, status, sync_status, created_at',
      messages: 'id, order_id, role, type, sync_status, created_at',
      orderItems: 'id, order_id, supplier_id, sync_status',
    });
  }
}

export const db = new AppDatabase();
