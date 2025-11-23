# Instrucciones para arreglar los supplier_orders faltantes

## Problema

Tienes 11 pedidos con status 'sent' pero solo 3 supplier_orders. Necesitamos crear los supplier_orders faltantes.

## Solución: Ejecutar SQL Manualmente

1. Ve al dashboard de Supabase: https://supabase.com/dashboard/project/ljagrvwsqbdxdiwblsqp
2. Navega a **SQL Editor**
3. Copia y pega este SQL:

```sql
-- Crear supplier_orders faltantes para pedidos enviados
INSERT INTO public.supplier_orders (order_id, supplier_id, status)
SELECT DISTINCT
  oi.order_id,
  oi.supplier_id,
  'pending' as status
FROM public.order_items oi
JOIN public.orders o ON o.id = oi.order_id
WHERE o.status = 'sent'
  AND oi.supplier_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.supplier_orders so
    WHERE so.order_id = oi.order_id
      AND so.supplier_id = oi.supplier_id
  )
ON CONFLICT (order_id, supplier_id) DO NOTHING;
```

4. Haz clic en **Run**
5. Verifica cuántas filas se insertaron (debería mostrar el número de supplier_orders creados)
6. Recarga la página de historial para ver todos los pedidos

## Verificación

Después de ejecutar el SQL, deberías ver muchos más supplier_orders en el historial (uno por cada proveedor en cada pedido enviado).
