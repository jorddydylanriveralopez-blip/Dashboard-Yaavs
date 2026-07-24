import {
  SESSION_EXPIRY_KEY,
  SESSION_HOURS,
  SESSION_KEY,
  SESSION_PERSIST_DAYS,
  SESSION_PERSIST_KEY,
} from '../constants';

function sessionMs(persist: boolean): number {
  if (persist) return SESSION_PERSIST_DAYS * 24 * 60 * 60 * 1000;
  return SESSION_HOURS * 60 * 60 * 1000;
}

function readRaw(storage: Storage): string | null {
  try {
    return storage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

function readExpiry(storage: Storage): number | null {
  try {
    const exp = storage.getItem(SESSION_EXPIRY_KEY);
    if (!exp) return null;
    const n = Number(exp);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

function clearBucket(storage: Storage) {
  try {
    storage.removeItem(SESSION_KEY);
    storage.removeItem(SESSION_EXPIRY_KEY);
    storage.removeItem(SESSION_PERSIST_KEY);
  } catch {
    /* ignore */
  }
}

/** Limpia sesión en sessionStorage y localStorage. */
export function clearAuthSession() {
  clearBucket(sessionStorage);
  clearBucket(localStorage);
}

/**
 * Lee la sesión vigente. Preferencia: localStorage (mantener activa)
 * y luego sessionStorage (solo esta pestaña).
 */
export function loadAuthSessionId(): { userId: string; persist: boolean } | null {
  const tryBucket = (storage: Storage, persist: boolean) => {
    const exp = readExpiry(storage);
    if (exp != null && Date.now() > exp) {
      clearBucket(storage);
      return null;
    }
    const raw = readRaw(storage);
    if (!raw) return null;
    try {
      const userId = JSON.parse(raw) as string;
      if (!userId || typeof userId !== 'string') return null;
      return { userId, persist };
    } catch {
      clearBucket(storage);
      return null;
    }
  };

  return tryBucket(localStorage, true) ?? tryBucket(sessionStorage, false);
}

/** Guarda la sesión tras el login. */
export function saveAuthSession(userId: string, persist: boolean) {
  const target = persist ? localStorage : sessionStorage;
  const other = persist ? sessionStorage : localStorage;
  clearBucket(other);
  try {
    target.setItem(SESSION_KEY, JSON.stringify(userId));
    target.setItem(SESSION_EXPIRY_KEY, String(Date.now() + sessionMs(persist)));
    target.setItem(SESSION_PERSIST_KEY, persist ? '1' : '0');
  } catch {
    /* quota / private mode */
  }
}

/** Renueva la fecha de caducidad si la sesión sigue activa (p. ej. al usar la app). */
export function touchAuthSessionExpiry(): boolean {
  const current = loadAuthSessionId();
  if (!current) return false;
  saveAuthSession(current.userId, current.persist);
  return true;
}

export function isAuthSessionPersistent(): boolean {
  return loadAuthSessionId()?.persist === true;
}
