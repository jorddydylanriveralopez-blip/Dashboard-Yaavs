import type { User } from '../types';

function apiBase(): string {
  const fromEnv = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '');
  if (fromEnv) return fromEnv;
  if (import.meta.env.PROD && typeof window !== 'undefined') return window.location.origin;
  return '';
}

export function vapidPublicKey(): string {
  return (import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined) ?? '';
}

export function isPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

export function pushPermission(): NotificationPermission | 'unsupported' {
  if (!isPushSupported()) return 'unsupported';
  return Notification.permission;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const output = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

/**
 * Muestra una notificación local de forma segura. En Android/Chrome móvil
 * `new Notification()` lanza «Illegal constructor»: hay que pasar por el
 * service worker. Nunca lanza; si no se puede notificar, no hace nada.
 */
export async function showLocalNotification(
  title: string,
  options?: NotificationOptions,
): Promise<void> {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  const opts: NotificationOptions = {
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    ...options,
  };
  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) {
        await reg.showNotification(title, opts);
        return;
      }
    }
  } catch {
    /* sigue al fallback */
  }
  try {
    new Notification(title, opts);
  } catch {
    /* plataforma sin soporte: silencioso */
  }
}

async function readyRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;
  try {
    return await navigator.serviceWorker.ready;
  } catch {
    return null;
  }
}

/** Suscribe el dispositivo actual a las notificaciones push del usuario. */
export async function subscribeToPush(
  user: Pick<User, 'id' | 'name' | 'employeeId'>,
  options: { requestPermission?: boolean } = {},
): Promise<{ ok: boolean; reason?: string }> {
  if (!isPushSupported()) return { ok: false, reason: 'unsupported' };
  const key = vapidPublicKey();
  if (!key) return { ok: false, reason: 'no-vapid' };

  let permission = Notification.permission;
  if (permission === 'default' && options.requestPermission) {
    permission = await Notification.requestPermission();
  }
  if (permission !== 'granted') return { ok: false, reason: permission };

  const reg = await readyRegistration();
  if (!reg) return { ok: false, reason: 'no-sw' };

  try {
    let subscription = await reg.pushManager.getSubscription();
    if (!subscription) {
      subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key),
      });
    }

    const res = await fetch(`${apiBase()}/api/push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'subscribe',
        subscription,
        userId: user.id,
        userName: user.name,
        employeeId: user.employeeId ?? null,
      }),
    });
    return { ok: res.ok };
  } catch {
    return { ok: false, reason: 'subscribe-failed' };
  }
}

export async function unsubscribeFromPush(): Promise<void> {
  const reg = await readyRegistration();
  if (!reg) return;
  const subscription = await reg.pushManager.getSubscription();
  if (!subscription) return;
  try {
    await fetch(`${apiBase()}/api/push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'unsubscribe', endpoint: subscription.endpoint }),
    });
    await subscription.unsubscribe();
  } catch {
    /* ignore */
  }
}

export interface PushNotifyPayload {
  audience?: 'all' | 'employees';
  employeeIds?: string[];
  userIds?: string[];
  excludeUserId?: string;
  title: string;
  body?: string;
  url?: string;
  tag?: string;
}

/** Pide al servidor que envíe una notificación push. No bloquea la UI. */
export function notifyPush(payload: PushNotifyPayload): void {
  // No exigir VITE_VAPID_PUBLIC_KEY aquí: esa clave solo hace falta para
  // suscribir el dispositivo. El envío lo hace el servidor con VAPID_*.
  void fetch(`${apiBase()}/api/push`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'notify', ...payload }),
    keepalive: true,
  }).catch(() => {
    /* silencioso */
  });
}
