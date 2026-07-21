import type { AppSyncState } from '../types';

const FETCH_TIMEOUT_MS = 30000;

function apiBase(): string {
  const fromEnv = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '');
  if (fromEnv) return fromEnv;
  // En producción las funciones /api/* viven en el mismo dominio (Vercel).
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

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const ctrl = new AbortController();
  const timer = window.setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(input, { ...init, signal: ctrl.signal });
  } finally {
    window.clearTimeout(timer);
  }
}

export async function fetchSyncState(): Promise<AppSyncState | null> {
  if (!isApiEnabled()) return null;
  try {
    const res = await fetchWithTimeout(`${API_URL}/api/state`, { cache: 'no-store' });
    if (!res.ok) return null;
    return (await res.json()) as AppSyncState;
  } catch {
    return null;
  }
}

export async function pushSyncState(
  state: AppSyncState,
): Promise<{ ok: boolean; updatedAt?: string }> {
  if (!isApiEnabled()) return { ok: false };
  try {
    const res = await fetchWithTimeout(`${API_URL}/api/state`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...state, updatedAt: new Date().toISOString() }),
    });
    if (!res.ok) return { ok: false };
    try {
      const body = (await res.json()) as { updatedAt?: string };
      return { ok: true, updatedAt: body.updatedAt ?? state.updatedAt };
    } catch {
      return { ok: true, updatedAt: state.updatedAt };
    }
  } catch {
    return { ok: false };
  }
}

export async function checkApiHealth(): Promise<boolean> {
  if (!isApiEnabled()) return false;
  try {
    const res = await fetchWithTimeout(`${API_URL}/api/health`, { cache: 'no-store' });
    return res.ok;
  } catch {
    return false;
  }
}
