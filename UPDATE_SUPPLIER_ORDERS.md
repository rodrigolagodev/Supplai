# Actualizar Supplier Orders Existentes

Los `supplier_orders` actuales están en status 'pending' pero deberían estar en 'sent' ya que los emails ya fueron enviados.

## SQL para ejecutar

**Dashboard de Supabase:** https://supabase.com/dashboard/project/ljagrvwsqbdxdiwblsqp/sql

```sql
-- Actualizar supplier_orders que deberían estar en 'sent'
-- (aquellos cuyo order principal tiene status 'sent')
UPDATE public.supplier_orders so
SET
  status = 'sent',
  sent_at = o.sent_at
FROM public.orders o
WHERE so.order_id = o.id
  AND o.status = 'sent'
  AND so.status = 'pending';

-- Verificar el resultado
SELECT
  status,
  COUNT(*) as count
FROM public.supplier_orders
GROUP BY status;
```

## Resultado Esperado

Después de ejecutar, deberías ver que los supplier_orders tienen status 'sent' en lugar de 'pending'.

## Siguientes Pasos

1. Ejecuta este SQL
2. Recarga la página de historial
3. Verifica que los pedidos ahora muestran status "Enviado" en lugar de "Pendiente"
4. Crea un nuevo pedido de prueba para verificar que el nuevo flujo funciona correctamente
