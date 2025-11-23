# 🐛 Debug Error 307/308 en Cron Job

## Tests para identificar el problema

### Test 1: Verificar que el endpoint existe

Abre tu navegador y ve a:

```
https://pedidos-ai.vercel.app/api/cron/process-jobs
```

**¿Qué ves?**

✅ **Si ves:** `{"error":"Unauthorized"}` → El endpoint funciona, es problema del secret
❌ **Si ves:** Error 404 → El endpoint no se desplegó correctamente
❌ **Si ves:** Redirect → Hay un problema de configuración

---

### Test 2: Probar con curl desde terminal

```bash
curl -v https://pedidos-ai.vercel.app/api/cron/process-jobs \
  -H "Authorization: Bearer x83Vj3amE5GX8Vl63S2g+sgMaf2rV2eboAZo3TIwBUI="
```

La opción `-v` (verbose) te mostrará todo el tráfico HTTP, incluyendo redirects.

**Busca en la respuesta:**

- `< HTTP/2 200` → Funciona ✅
- `< HTTP/2 307` o `308` → Hay redirect ❌
- `< location: ...` → Te dice a dónde redirige

---

### Test 3: Verificar el formato exacto del secret

En GitHub → Settings → Secrets → Actions:

**APP_URL debe ser EXACTAMENTE:**

```
https://pedidos-ai.vercel.app
```

**Verifica:**

- [ ] Empieza con `https://`
- [ ] NO tiene `http://`
- [ ] NO tiene `/` al final
- [ ] NO tiene espacios antes o después
- [ ] Es exactamente tu dominio de Vercel

---

### Test 4: Verificar logs en Vercel

1. Ve a Vercel → Tu proyecto
2. **Functions** (en la sidebar)
3. Busca `/api/cron/process-jobs`
4. Ver los logs recientes

**¿Qué ves en los logs?**

- Si no hay logs → El request no está llegando
- Si hay logs con "Unauthorized" → El secret está mal
- Si hay logs exitosos → El endpoint funciona

---

## Posibles Causas del 307

### 1. Trailing slash en la URL del secret

❌ `https://pedidos-ai.vercel.app/`
✅ `https://pedidos-ai.vercel.app`

### 2. HTTP en lugar de HTTPS

❌ `http://pedidos-ai.vercel.app`
✅ `https://pedidos-ai.vercel.app`

### 3. Dominio incorrecto

Verifica en Vercel cuál es tu dominio exacto:

- Settings → Domains

### 4. Trailing slash en el workflow

En `.github/workflows/process-jobs.yml` línea 19:

Debe ser:

```yaml
'${{ secrets.APP_URL }}/api/cron/process-jobs'
```

Si tuviera doble slash sería:

```yaml
'${{ secrets.APP_URL }}//api/cron/process-jobs' # ❌ MAL
```

---

## Solución Temporal: Hardcodear la URL

Para descartar que sea problema del secret, podemos hardcodear temporalmente:

1. Ve al archivo: `.github/workflows/process-jobs.yml`
2. Línea 19, reemplaza:

   ```yaml
   "${{ secrets.APP_URL }}/api/cron/process-jobs" \
   ```

   Por:

   ```yaml
   "https://pedidos-ai.vercel.app/api/cron/process-jobs" \
   ```

3. Commit y push
4. Ejecuta el workflow

Si funciona → El problema es el formato del secret `APP_URL`
Si sigue fallando → El problema es otra cosa

---

## Siguiente paso

**Ejecuta Test 1 primero** (abre la URL en tu navegador) y dime qué ves.
