import { useSyncExternalStore } from 'react';

/**
 * Un solo reloj de 1s para todo el dashboard (cronómetros, etc.).
 * Evita N setInterval × N chips → una sola actualización por segundo.
 * Se pausa cuando la pestaña está oculta.
 */
type Listener = () => void;

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
  intervalId = setInterval(emit, 1000);
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

/** Ahora compartido; se actualiza ~1/s solo con suscriptores y pestaña visible. */
export function useSharedNow(enabled = true): number {
  return useSyncExternalStore(
    enabled ? subscribe : subscribeNoop,
    getSnapshot,
    getServerSnapshot,
  );
}
