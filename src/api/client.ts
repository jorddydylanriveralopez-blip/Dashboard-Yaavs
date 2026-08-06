import type { AppSyncState } from '../types';
import { CALENDAR_SYNC_USER_ID } from '../constants';

/** Estado completo (proyectos + evidencias) puede tardar; no bajar de ~2 min. */
const STATE_TIMEOUT_MS = 180_000;
const HEALTH_TIMEOUT_MS = 8_000;

function apiBase(): string {
  const fromEnv = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '');
  if (fromEnv) return fromEnv;
  if (import.meta.env.PROD && typeof window !== 'undefined') return window.location.origin;
  return '';
}

const API_URL = apiBase();

function isLocalhostApi(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return host === 'localhost' || host === '127.0.0.1';
  } catch {
    return false;
  }
}

/** En celular, localhost apunta al teléfono — desactivar sync automático. */
export function isApiEnabled(): boolean {
  if (!API_URL) return false;
  if (typeof window !== 'undefined' && isLocalhostApi(API_URL)) {
    const pageHost = window.location.hostname;
    if (pageHost !== 'localhost' && pageHost !== '127.0.0.1') return false;
  }
  return true;
}

export function getApiBaseUrl(): string {
  return API_URL;
}

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  timeoutMs: number,
): Promise<Response> {
  const ctrl = new AbortController();
  const timer = window.setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: ctrl.signal });
  } finally {
    window.clearTimeout(timer);
  }
}

async function withRetry<T>(
  run: () => Promise<T | null>,
  attempts = 2,
  pauseMs = 1200,
): Promise<T | null> {
  let last: T | null = null;
  for (let i = 0; i < attempts; i += 1) {
    last = await run();
    if (last != null) return last;
    if (i < attempts - 1) {
      await new Promise((r) => window.setTimeout(r, pauseMs * (i + 1)));
    }
  }
  return last;
}

export async function fetchSyncState(
  viewerUserId?: string | null,
): Promise<AppSyncState | null> {
  if (!isApiEnabled()) return null;
  return withRetry(async () => {
    try {
      const qs = viewerUserId
        ? `?userId=${encodeURIComponent(viewerUserId)}`
        : '';
      const res = await fetchWithTimeout(
        `${API_URL}/api/state${qs}`,
        { cache: 'no-store' },
        STATE_TIMEOUT_MS,
      );
      if (!res.ok) return null;
      return (await res.json()) as AppSyncState;
    } catch {
      return null;
    }
  });
}

export async function pushSyncState(
  state: AppSyncState,
): Promise<{ ok: boolean; updatedAt?: string; timedOut?: boolean }> {
  if (!isApiEnabled()) return { ok: false };
  try {
    const res = await fetchWithTimeout(
      `${API_URL}/api/state`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...state, updatedAt: new Date().toISOString() }),
      },
      STATE_TIMEOUT_MS,
    );
    if (!res.ok) return { ok: false };
    try {
      const body = (await res.json()) as { updatedAt?: string };
      return { ok: true, updatedAt: body.updatedAt ?? state.updatedAt };
    } catch {
      return { ok: true, updatedAt: state.updatedAt };
    }
  } catch {
    return { ok: false, timedOut: true };
  }
}

export async function checkApiHealth(): Promise<boolean> {
  if (!isApiEnabled()) return false;
  try {
    const res = await fetchWithTimeout(
      `${API_URL}/api/health`,
      { cache: 'no-store' },
      HEALTH_TIMEOUT_MS,
    );
    return res.ok;
  } catch {
    return false;
  }
}

export interface ExternalCalendarStatus {
  configured: boolean;
  connected: boolean;
  userId: string;
  email: string | null;
  lastSyncAt: string | null;
  lastError: string | null;
  eventCount?: number | null;
}

/** @deprecated usar ExternalCalendarStatus */
export type OutlookStatus = ExternalCalendarStatus;

export function getGoogleAuthUrl(userId: string = CALENDAR_SYNC_USER_ID): string | null {
  if (!isApiEnabled()) return null;
  return `${API_URL}/api/google/auth?userId=${encodeURIComponent(userId)}`;
}

/** Devuelve la URL real de Google OAuth (evita que Hostinger sirva el SPA en /api/google/auth). */
export async function fetchGoogleAuthUrl(
  userId: string = CALENDAR_SYNC_USER_ID,
  options?: { ownerName?: string },
): Promise<{ ok: boolean; url?: string; error?: string }> {
  if (!isApiEnabled()) return { ok: false, error: 'API no disponible' };
  try {
    const params = new URLSearchParams({ userId });
    if (options?.ownerName) params.set('ownerName', options.ownerName);
    const res = await fetchWithTimeout(
      `${API_URL}/api/google/auth-url?${params}`,
      { cache: 'no-store' },
      HEALTH_TIMEOUT_MS,
    );
    const data = (await res.json().catch(() => ({}))) as {
      url?: string;
      error?: string;
    };
    if (!res.ok || !data.url) {
      return { ok: false, error: data.error || 'No se pudo obtener la URL de Google' };
    }
    return { ok: true, url: data.url };
  } catch {
    return { ok: false, error: 'No se pudo obtener la URL de Google' };
  }
}

export async function fetchGoogleCalendarStatus(
  userId: string = CALENDAR_SYNC_USER_ID,
): Promise<ExternalCalendarStatus | null> {
  if (!isApiEnabled()) return null;
  try {
    const res = await fetchWithTimeout(
      `${API_URL}/api/google/status?userId=${encodeURIComponent(userId)}`,
      { cache: 'no-store' },
      HEALTH_TIMEOUT_MS,
    );
    if (!res.ok) return null;
    return (await res.json()) as ExternalCalendarStatus;
  } catch {
    return null;
  }
}

export async function exchangeGoogleOAuthCode(input: {
  code: string;
  state?: string | null;
  redirectUri?: string | null;
}): Promise<{ ok: boolean; error?: string; eventCount?: number; email?: string | null }> {
  if (!isApiEnabled()) return { ok: false, error: 'API no disponible' };
  try {
    const res = await fetchWithTimeout(
      `${API_URL}/api/google/exchange`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: input.code,
          state: input.state || CALENDAR_SYNC_USER_ID,
          redirectUri: input.redirectUri || undefined,
        }),
      },
      STATE_TIMEOUT_MS,
    );
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      error?: string;
      eventCount?: number;
      email?: string | null;
    };
    if (!res.ok || data.ok === false) {
      return { ok: false, error: data.error || 'No se pudo completar el acceso con Google' };
    }
    return { ok: true, eventCount: data.eventCount, email: data.email };
  } catch {
    return { ok: false, error: 'No se pudo completar el acceso con Google' };
  }
}

export async function triggerGoogleCalendarSync(
  userId: string = CALENDAR_SYNC_USER_ID,
): Promise<{ ok: boolean; error?: string; eventCount?: number }> {
  if (!isApiEnabled()) return { ok: false, error: 'API no disponible' };
  try {
    const res = await fetchWithTimeout(
      `${API_URL}/api/google/sync`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      },
      STATE_TIMEOUT_MS,
    );
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      error?: string;
      eventCount?: number;
    };
    if (!res.ok) return { ok: false, error: data.error || 'Error al sincronizar' };
    return { ok: true, eventCount: data.eventCount };
  } catch {
    return { ok: false, error: 'No se pudo sincronizar Google Calendar' };
  }
}

export async function saveGoogleOAuthConfig(input: {
  clientId: string;
  clientSecret: string;
  redirectUri?: string;
}): Promise<{ ok: boolean; error?: string }> {
  if (!isApiEnabled()) return { ok: false, error: 'API no disponible' };
  try {
    const res = await fetchWithTimeout(
      `${API_URL}/api/google/configure`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      },
      HEALTH_TIMEOUT_MS,
    );
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
    if (!res.ok) return { ok: false, error: data.error || 'No se pudo guardar' };
    return { ok: true };
  } catch {
    return { ok: false, error: 'No se pudo guardar la configuración' };
  }
}
