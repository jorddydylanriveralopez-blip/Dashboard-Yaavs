import { useSyncExternalStore } from 'react';

/**
 * Relojes compartidos para el dashboard.
 * - Rápido (1s): cronómetros / overtime activos.
 * - Lento (15s): chips de plazo (no hace falta 1 Hz).
 * Se pausan cuando la pestaña está oculta.
 */
type Listener = () => void;

function createSharedClock(intervalMs: number) {
  let nowMs = Date.now();
  let intervalId: ReturnType<typeof setInterval> | null = null;
  const listeners = new Set<Listener>();

  function emit() {
    nowMs = Date.now();
    for (const listener of listeners) listener();
  }

  function start() {
    if (intervalId != null) return;
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
    intervalId = setInterval(emit, intervalMs);
  }

  function stop() {
    if (intervalId == null) return;
    clearInterval(intervalId);
    intervalId = null;
  }

  function onVisibility() {
    if (typeof document === 'undefined') return;
    if (document.visibilityState === 'hidden') {
      stop();
    } else {
      emit();
      if (listeners.size > 0) start();
    }
  }

  let visibilityBound = false;
  function ensureVisibilityListener() {
    if (visibilityBound || typeof document === 'undefined') return;
    visibilityBound = true;
    document.addEventListener('visibilitychange', onVisibility);
  }

  function subscribe(listener: Listener): () => void {
    ensureVisibilityListener();
    listeners.add(listener);
    if (listeners.size === 1) start();
    return () => {
      listeners.delete(listener);
      if (listeners.size === 0) stop();
    };
  }

  function getSnapshot(): number {
    return nowMs;
  }

  function getServerSnapshot(): number {
    return nowMs;
  }

  function subscribeNoop(_unused: Listener): () => void {
    void _unused;
    return () => {};
  }

  return {
    use(enabled = true): number {
      return useSyncExternalStore(
        enabled ? subscribe : subscribeNoop,
        getSnapshot,
        getServerSnapshot,
      );
    },
  };
}

const fastClock = createSharedClock(1000);
const slowClock = createSharedClock(15_000);

/** Ahora compartido ~1/s (cronómetros). Solo corre con suscriptores activos. */
export function useSharedNow(enabled = true): number {
  return fastClock.use(enabled);
}

/** Ahora compartido ~15/s para plazos / deadlines (menos trabajo en main thread). */
export function useSharedNowSlow(enabled = true): number {
  return slowClock.use(enabled);
}
