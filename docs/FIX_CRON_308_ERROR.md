# 🔧 Fix Error 308 en Cron Job

## Problema

```
HTTP Status: 308
Response: Redirecting...
Error: Job processing failed with status 308
```

## Causa

El código 308 es un "Permanent Redirect". Vercel está redirigiendo la petición, usualmente por:

1. ❌ URL usa `http://` en lugar de `https://`
2. ❌ URL tiene una barra final `/` que no debería
3. ❌ URL tiene formato incorrecto

## Solución

### 1. Verificar el Secret APP_URL en GitHub

Ve a: https://github.com/rodrigolagodev/pedidosAI/settings/secrets/actions

Busca el secret `APP_URL` y verifica que tenga este formato:

✅ **CORRECTO:**

```
https://tu-app.vercel.app
```

❌ **INCORRECTO:**

```
http://tu-app.vercel.app          (sin https)
https://tu-app.vercel.app/        (con barra final)
http://tu-app.vercel.app/         (ambos errores)
```

### 2. Editar el Secret

1. Click en el lápiz (Edit) del secret `APP_URL`
2. Asegúrate que sea **EXACTAMENTE**:
   - Comienza con `https://` (no `http://`)
   - Termina SIN barra `/`
   - Ejemplo: `https://pedidosai-abc123.vercel.app`
3. **Update secret**

### 3. Probar nuevamente

1. Ve a: https://github.com/rodrigolagodev/pedidosAI/actions
2. Click en **Process Job Queue**
3. **Run workflow** → **Run workflow**
4. Espera 10 segundos
5. Click en el run
6. Deberías ver: `HTTP Status: 200` ✅

## Verificación Rápida

Puedes probar manualmente desde tu terminal:

```bash
# Reemplaza TU_URL con tu URL de Vercel
curl -X GET https://tu-app.vercel.app/api/cron/process-jobs \
  -H "Authorization: Bearer x83Vj3amE5GX8Vl63S2g+sgMaf2rV2eboAZo3TIwBUI="
```

**Respuesta esperada:**

```json
{
  "success": true,
  "message": "Jobs processed successfully",
  "timestamp": "2025-01-23T..."
}
```

Si ves esto, el endpoint funciona correctamente.

---

## Debugging Adicional

Si el problema persiste:

### Verificar que el endpoint existe

En tu navegador, ve a:

```
https://tu-app.vercel.app/api/cron/process-jobs
```

Deberías ver:

```json
{ "error": "Unauthorized" }
```

Esto es correcto - significa que el endpoint existe pero rechaza peticiones sin el CRON_SECRET.

### Ver logs en Vercel

1. Vercel → Tu proyecto → **Functions**
2. Busca `/api/cron/process-jobs`
3. Ver logs de la última ejecución

---

**Siguiente paso:** Una vez corregida la URL, vuelve a ejecutar el workflow manualmente.
