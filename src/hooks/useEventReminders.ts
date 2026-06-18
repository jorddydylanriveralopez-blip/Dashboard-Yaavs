import { useEffect } from 'react';
import { COMPANY_NAME } from '../constants';
import { parseEventDateTime } from '../utils/calendarDates';
import type { CalendarEvent } from '../types';

function mayNotify(): boolean {
  return typeof Notification !== 'undefined' && Notification.permission === 'granted';
}

export function useEventReminders(
  events: CalendarEvent[],
  onMarkReminded: (id: string) => void,
) {
  useEffect(() => {
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  useEffect(() => {
    const tick = () => {
      if (!mayNotify()) return;
      const now = Date.now();

      for (const ev of events) {
        if (ev.done || ev.reminderMinutes <= 0 || ev.remindedAt) continue;
        const start = parseEventDateTime(ev.date, ev.time).getTime();
        const remindAt = start - ev.reminderMinutes * 60_000;
        if (now >= remindAt && now < start + 60_000) {
          new Notification(`${COMPANY_NAME} — Recordatorio`, {
            body: `${ev.title} · ${ev.time}`,
            tag: ev.id,
          });
          onMarkReminded(ev.id);
        }
      }
    };

    tick();
    const id = window.setInterval(tick, 30_000);
    return () => window.clearInterval(id);
  }, [events, onMarkReminded]);
}
