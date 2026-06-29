#  PATHWORK PWA

Aplicación web progresiva (PWA) para gestión personal de vacantes laborales.

---

## 🚀 Stack Tecnológico

### Frontend

* **React**
* **TypeScript**
* **Vite**

### Backend

* **Supabase**

  * Base de datos PostgreSQL
  * Edge Functions (serverless)
  * Scheduler (cron jobs)

### Hosting

* **Vercel**

---

## 🧠 ¿Por qué este stack?

### React

Permite construir interfaces dinámicas basadas en componentes reutilizables.
Es ideal para manejar estados como:

* vacantes
* filtros
* formularios

---

### TypeScript

Agrega tipado estático a JavaScript, lo que:

* reduce errores
* mejora la mantenibilidad
* facilita escalar el proyecto

---

### Vite

Herramienta de build extremadamente rápida:

* arranque instantáneo
* hot reload eficiente

---

### Supabase

Backend completo sin necesidad de servidor propio:

* base de datos
* autenticación
* funciones serverless
* cron jobs
*Considerar las edge functions

---

### Vercel

Hosting optimizado para frontend:

* despliegue automático
* CDN global
* integración perfecta con React/Vite

---

## 📱 Características

* PWA instalable
* Notificaciones push
* Scraping de vacantes
* Gestión de estados
* Logs descargables

---

## 🎯 Objetivo

Centralizar y automatizar el seguimiento de postulaciones laborales de forma simple y eficiente.

---

## ⚙️ Deploy

1. Subir frontend a Vercel
2. Configurar Supabase
3. Deploy de Edge Functions
4. Configurar variables de entorno

---

Proyecto diseñado para uso personal con foco en simplicidad y eficiencia.

# PATHWORK

Aplicación para gestionar postulaciones laborales con Supabase.

## Estructura del proyecto

- src/: punto de entrada de la aplicación
- public/: archivos estáticos
- supabase/: configuración y migraciones de Supabase
- docs/: documentación de API y endpoints

## Supabase

1. Configura tus variables de entorno con .env.
2. Aplica la migración en Supabase:
   - supabase db push
3. Usa los endpoints REST de PostgREST:
   - /rest/v1/jobs
   - /rest/v1/applications

## GitHub

El repositorio remoto ya está conectado a:
- https://github.com/MateoGarrido13/PATHWORK.git

## Siguiente paso recomendado

Conectar el proyecto a Vercel y preparar el frontend real para consumir estos endpoints.
