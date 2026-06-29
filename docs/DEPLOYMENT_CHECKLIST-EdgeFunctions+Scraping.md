# Deployment Checklist — Scraping

## 1. Variables de Entorno

### Supabase → Edge Functions → Secrets

- [ ] `ANTHROPIC_API_KEY` = `sk-ant-...`
  - Obtener de https://console.anthropic.com/account/keys
  - Recuerda: esta clave se usa para rellenar campos con Claude

### `.env.local` (desarrollo local)

```bash
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=xxxxxx
VITE_SUPABASE_FUNCTION_URL=https://xxxxx.supabase.co/functions/v1
```

### `package.json` o `.env` (Vercel)

```
VITE_SUPABASE_FUNCTION_URL = https://xxxxx.supabase.co/functions/v1
```

---

## 2. Schema en Supabase

- [ ] Aplicar `schema-patch.sql` original (4 tipos + tablas base)
- [ ] Aplicar `schema-patch-fuentes.sql` (SCRAPING_CONFIG + LOG_SCRAPING)

Verificar en Supabase SQL Editor:
```sql
SELECT enum_range(NULL::fuente_vacante) AS fuentes;
-- Debe retornar: computrabajo, bumeran, zonajobs, getonboard, indeed, otros

SELECT * FROM SCRAPING_CONFIG LIMIT 1;
-- Debe retornar 6 filas con configuración inicial
```

---

## 3. Edge Functions

### 3a. Crear carpetas

```bash
mkdir -p supabase/functions/_shared
mkdir -p supabase/functions/scrape-job
```

### 3b. Copiar archivos

- [ ] `scrape-job/index.ts` → desde el artifact
- [ ] `_shared/scraping-helpers.ts` → desde el artifact

### 3c. Verificar `deno.json`

En la raíz del proyecto:
```json
{
  "imports": {
    "@supabase/supabase-js": "https://esm.sh/@supabase/supabase-js@2"
  }
}
```

### 3d. Deployer

```bash
# Login (si es necesario)
supabase login

# Deployer la función
supabase functions deploy scrape-job

# Verificar en Supabase Dashboard
# → Edge Functions → scrape-job → Debe estar "Deployed"
```

---

## 4. React Components

- [ ] `src/hooks/useScrapeJob.ts` (hook)
- [ ] `src/components/NewVacanteForm.tsx` (formulario con scraping)
- [ ] Importar componente en la ruta adecuada (ej: `/create-vacancy`)

---

## 5. Testing Manual

### Test 1: Computrabajo (JSON-LD confiable)

```
URL: https://www.computrabajo.com.ar/busquedas/CUALQUIER-VACANTE
Fuente: computrabajo

Esperado:
- empresa ✓ (desde JSON-LD)
- puesto ✓ (desde JSON-LD)
- requisitos ✓ (desde JSON-LD)
- modalidad: posible ✓
```

### Test 2: URL sin JSON-LD (rellenar con Claude)

```
URL: https://www.ejemplo.com/vacante-123
Fuente: otros

Esperado:
- Scraping de meta tags
- Si faltan campos → Claude rellena
- metadata.source_claude mostrará qué agregó Claude
```

### Test 3: Error Handling

```
URL: https://localhost:9999/no-existe
Fuente: otros

Esperado:
- Error capturado
- Mensaje claro en frontend
- Log en LOG_SCRAPING con status='failed'
```

---

## 6. Monitoreo

### Ver logs de Edge Function

```bash
supabase functions list
# Seleccionar scrape-job → "View logs"
```

### Auditoría en BD

```sql
-- Ver últimos 10 scraping
SELECT 
  fuente, 
  status, 
  duration_ms, 
  error_message 
FROM LOG_SCRAPING 
ORDER BY created_at DESC 
LIMIT 10;

-- Ver por qué un scraping falló
SELECT metadata, error_message 
FROM LOG_SCRAPING 
WHERE status = 'failed' 
ORDER BY created_at DESC 
LIMIT 1;
```

---

## 7. Troubleshooting

### Error: "ANTHROPIC_API_KEY not set"

→ Ir a Supabase → Edge Functions → Secrets  
→ Agregar `ANTHROPIC_API_KEY`  
→ Redeploy

### Error: "Parse error" en JSON-LD

→ Algunos portales usan sintaxis no estándar  
→ Validar en https://validator.schema.org/  
→ Si problema persiste, aumentar fallback a Claude

### Timeout en edge function (>10s)

→ Reducir `timeout` de fetch (actualmente 10s)  
→ O aumentar `max_tokens` de Claude para respuesta más rápida  
→ Considerar caché (futura mejora)

### Indeed/LinkedIn bloqueados con error 403

→ **Esperado** — detectar fuente, mostrar error  
→ En frontend: sugerir al usuario que copie los datos manualmente  
→ O proponer scrapers alternativos (visionapi, etc.)

---

## 8. Límites y Consideraciones

| Límite | Valor |
|---|---|
| Timeout por scrape | 10s |
| Max tokens Claude | 500 |
| HTML máximo | ~3MB (Deno edge function limit) |
| Llamadas a Claude | Depende de tu plan Anthropic |
| Rate limiting | Ninguno configurado (agregar si es necesario) |

**Costos esperados:**
- Scraping sin Claude: ~$0
- Scraping con Claude (Tier 3): ~$0.01-0.05 USD por vacante

---

## 9. Siguiente Paso

Una vez que el scraping está funcionando:
- [ ] Edge Function del scheduler (22:00 ART)
- [ ] Notificaciones push + email
- [ ] Panel frontend (listado de vacantes)