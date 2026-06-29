// ============================================================
// INSTALL — activa el SW inmediatamente sin esperar al reload
// ============================================================
self.addEventListener('install', () => {
  self.skipWaiting();
});

// ============================================================
// ACTIVATE — toma control de todos los clientes abiertos
// ============================================================
self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

// ============================================================
// PUSH — recibe la notificación del servidor y la muestra
// Funciona aunque la app esté cerrada.
// ============================================================
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    // Fallback si el payload no es JSON válido
    payload = { title: 'Job Tracker', body: event.data.text() };
  }

  const options = {
    body: payload.body ?? '',
    icon: '/icons/WORKPATH192.png',
    badge: '/icons/badge-72.png',

    // tag agrupa notificaciones: una nueva del mismo tag reemplaza la anterior
    tag: payload.tag ?? 'vacante-alert',

    // La notificación permanece hasta que el usuario interactúe
    requireInteraction: true,

    // Datos pasados al handler de click
    data: { url: payload.url ?? '/' },
  };

  event.waitUntil(
    self.registration.showNotification(payload.title ?? 'Job Tracker', options)
  );
});

// ============================================================
// NOTIFICATION CLICK — abre o enfoca la app al tocar la notif
// ============================================================
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url ?? '/';

  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((openClients) => {
        // Si la app ya está abierta en alguna pestaña, la enfoca
        for (const client of openClients) {
          if (client.url.startsWith(self.location.origin) && 'focus' in client) {
            return client.focus();
          }
        }
        // Si no hay ninguna abierta, abre una nueva
        return clients.openWindow(targetUrl);
      })
  );
}
// ============================================================
// 
// ============================================================
import { initPush, refreshLastSeen } from '@/lib/push';

// Al validar el PIN exitosamente:
const handleLogin = async () => {
  const valid = await validatePin(pin);
  if (!valid) return;

  await initPush();         // primera vez: pide permiso + registra
  await refreshLastSeen();  // visitas siguientes: actualiza timestamp
  navigate('/');
};);