import type { CalendarEvent } from '../types';
import { CALENDAR_EMAIL_BY_USER } from '../constants';

function apiBase(): string {
  const fromEnv = import.meta.env.VITE_API_URL?.replace(/\/$/, '');
  if (fromEnv) return fromEnv;
  if (typeof window !== 'undefined') return window.location.origin;
  return '';
}

export function reminderEmailForUser(userId: string, overrideEmail?: string): string | null {
  const trimmed = (overrideEmail ?? '').trim();
  if (trimmed) return trimmed;
  return CALENDAR_EMAIL_BY_USER[userId] ?? null;
}

export async function syncCalendarForReminders(input: {
  userId: string;
  userName: string;
  email?: string;
  events: CalendarEvent[];
}): Promise<boolean> {
  const base = apiBase();
  if (!base) return false;

  try {
    const res = await fetch(`${base}/api/calendar/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function sendCalendarReminderEmail(input: {
  userId: string;
  userName: string;
  email?: string;
  event: CalendarEvent;
}): Promise<{ ok: boolean; error?: string }> {
  const base = apiBase();
  if (!base) return { ok: false, error: 'Sin API' };

  try {
    const res = await fetch(`${base}/api/calendar/send-reminder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      return { ok: false, error: data.error ?? `Error ${res.status}` };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: 'No se pudo contactar al servidor' };
  }
}

/** Avisa a Orlando al instante cuando alguien del equipo cambia la agenda. */
export function notifyOrlandoAgendaAlert(input: {
  actorName: string;
  title: string;
  body: string;
  date?: string;
  time?: string;
}): void {
  const base = apiBase();
  if (!base) return;
  void fetch(`${base}/api/calendar/send-alert`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      toUserId: 'u-orlando',
      actorName: input.actorName,
      title: input.title,
      body: input.body,
      date: input.date,
      time: input.time,
    }),
    keepalive: true,
  }).catch(() => {
    /* silencioso */
  });
}
