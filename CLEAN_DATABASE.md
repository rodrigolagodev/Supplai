# Limpiar Base de Datos - Borrar Todos los Pedidos

## SQL para ejecutar

**Dashboard de Supabase:** https://supabase.com/dashboard/project/ljagrvwsqbdxdiwblsqp/sql

```sql
-- IMPORTANTE: Este script borra TODOS los pedidos y datos relacionados

-- 1. Borrar supplier_orders (pedidos individuales por proveedor)
DELETE FROM public.supplier_orders;

-- 2. Borrar order_items (items de los pedidos)
DELETE FROM public.order_items;

-- 3. Borrar orders (pedidos principales)
DELETE FROM public.orders;

-- Verificar que todo se borró correctamente
SELECT
  (SELECT COUNT(*) FROM public.orders) as orders_count,
  (SELECT COUNT(*) FROM public.order_items) as items_count,
  (SELECT COUNT(*) FROM public.supplier_orders) as supplier_orders_count;
```

## ✅ Resultado Esperado

Todos los contadores deberían mostrar **0**:

- `orders_count: 0`
- `items_count: 0`
- `supplier_orders_count: 0`

## Siguiente Paso

Después de ejecutar:

1. Recarga `/[slug]/history` → debe estar vacío
2. Crea un pedido de prueba nuevo
3. Verifica que aparece correctamente
