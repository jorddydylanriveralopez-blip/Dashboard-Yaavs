import type { AppSyncState } from '../types';

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

export async function fetchSyncState(): Promise<AppSyncState | null> {
  if (!isApiEnabled()) return null;
  return withRetry(async () => {
    try {
      const res = await fetchWithTimeout(
        `${API_URL}/api/state`,
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
