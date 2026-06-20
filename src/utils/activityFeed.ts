import { ACTIVITY_FEED_KEY } from '../constants';
import type { ActivityEvent, ActivityKind } from '../types';

const MAX_EVENTS = 120;

export function loadActivityFeed(): ActivityEvent[] {
  try {
    const raw = localStorage.getItem(ACTIVITY_FEED_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ActivityEvent[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveActivityFeed(events: ActivityEvent[]): void {
  localStorage.setItem(ACTIVITY_FEED_KEY, JSON.stringify(events.slice(0, MAX_EVENTS)));
}

export function createActivity(
  kind: ActivityKind,
  message: string,
  actorName: string,
): ActivityEvent {
  return {
    id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    kind,
    message,
    actorName,
    at: new Date().toISOString(),
  };
}

export function prependActivity(
  events: ActivityEvent[],
  kind: ActivityKind,
  message: string,
  actorName: string,
): ActivityEvent[] {
  const next = [createActivity(kind, message, actorName), ...events].slice(0, MAX_EVENTS);
  saveActivityFeed(next);
  return next;
}

export function formatActivityTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Ahora';
  if (mins < 60) return `Hace ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Hace ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `Hace ${days} día${days > 1 ? 's' : ''}`;
  return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
}
