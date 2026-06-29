# Endpoints de Supabase

La base de datos expone automáticamente endpoints REST a través de PostgREST.

## Base URL

- https://<project-ref>.supabase.co/rest/v1

## Headers requeridos

- apikey: tu anon key de Supabase
- Authorization: Bearer <token>
- Content-Type: application/json

## Endpoints disponibles

### Jobs
- GET /rest/v1/jobs?select=*
- POST /rest/v1/jobs
- PATCH /rest/v1/jobs?id=eq.<uuid>
- DELETE /rest/v1/jobs?id=eq.<uuid>

### Applications
- GET /rest/v1/applications?select=*
- POST /rest/v1/applications
- PATCH /rest/v1/applications?id=eq.<uuid>
- DELETE /rest/v1/applications?id=eq.<uuid>

### Ejemplo de lectura

```bash
curl -X GET "https://<project-ref>.supabase.co/rest/v1/jobs?select=*" \
  -H "apikey: <anon-key>" \
  -H "Authorization: Bearer <anon-key>"
```

### Ejemplo de inserción

```bash
curl -X POST "https://<project-ref>.supabase.co/rest/v1/jobs" \
  -H "apikey: <anon-key>" \
  -H "Authorization: Bearer <anon-key>" \
  -H "Content-Type: application/json" \
  -d '{"title":"Senior Frontend","company":"Acme","status":"interested"}'
```
