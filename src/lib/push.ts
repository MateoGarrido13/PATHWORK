import { supabase } from '~/c/Users/mateo/PathWork/supabase';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string;

// ============================================================
// HELPER — convierte la VAPID public key al formato que
// espera pushManager.subscribe()
// ============================================================
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

// ============================================================
// Detecta el dispositivo para identificar la suscripción en DB
// ============================================================
function getDeviceHint(): string {
  const ua = navigator.userAgent;
  const isMobile = /Mobi|Android/i.test(ua);
  const browser = /Edg/i.test(ua)
    ? 'Edge'
    : /Chrome/i.test(ua)
    ? 'Chrome'
    : /Firefox/i.test(ua)
    ? 'Firefox'
    : /Safari/i.test(ua)
    ? 'Safari'
    : 'Browser';
  return `${browser}/${isMobile ? 'Mobile' : 'PC'}`;
}

// ============================================================
// PASO 1 — Registrar el Service Worker
// ============================================================
export async function registerSW(): Promise<ServiceWorkerRegistration> {
  if (!('serviceWorker' in navigator)) {
    throw new Error('Service Workers no soportados en este navegador.');
  }
  const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  await navigator.serviceWorker.ready;
  return reg;
}

// ============================================================
// PASO 2 — Solicitar permiso y crear la suscripción push
// Reutiliza la suscripción existente si ya hay una.
// ============================================================
export async function subscribeToPush(
  registration: ServiceWorkerRegistration
): Promise<PushSubscription | null> {
  if (!('PushManager' in window)) {
    console.warn('Push API no soportada en este navegador.');
    return null;
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    console.warn('Permiso de notificaciones denegado por el usuario.');
    return null;
  }

  // Reutilizar suscripción existente si ya existe
  const existing = await registration.pushManager.getSubscription();
  if (existing) return existing;

  return registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
  });
}

// ============================================================
// PASO 3 — Persistir la suscripción en Supabase
// Usa UPSERT en endpoint para manejar re-suscripciones
// (cuando el browser rota las claves push)
// ============================================================
export async function saveSubscription(sub: PushSubscription): Promise<void> {
  const { endpoint, keys } = sub.toJSON() as {
    endpoint: string;
    keys: { p256dh: string; auth: string };
  };

  const { error } = await supabase.from('PUSH_SUBSCRIPTIONS').upsert(
    {
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
      device_hint: getDeviceHint(),
      last_seen: new Date().toISOString(),
    },
    { onConflict: 'endpoint' }
  );

  if (error) throw new Error(`Error guardando suscripción: ${error.message}`);
}

// ============================================================
// MANTENIMIENTO — actualizar last_seen al abrir la app
// Permite detectar suscripciones inactivas en el futuro
// ============================================================
export async function refreshLastSeen(): Promise<void> {
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return;

  await supabase
    .from('PUSH_SUBSCRIPTIONS')
    .update({ last_seen: new Date().toISOString() })
    .eq('endpoint', sub.endpoint);
}

// ============================================================
// ENTRADA PRINCIPAL — llamar una vez tras el login con PIN
// ============================================================
export async function initPush(): Promise<boolean> {
  try {
    const reg = await registerSW();
    const sub = await subscribeToPush(reg);
    if (!sub) return false;
    await saveSubscription(sub);
    return true;
  } catch (err) {
    console.error('[Push] Error de inicialización:', err);
    return false;
  }
}