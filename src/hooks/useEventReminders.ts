import { useEffect } from 'react';
import { COMPANY_NAME } from '../constants';
import { sendCalendarReminderEmail, reminderEmailForUser } from '../api/calendar';
import { showLocalNotification } from '../api/pushClient';
import { parseEventDateTime } from '../utils/calendarDates';
import type { CalendarEvent } from '../types';

function mayNotify(): boolean {
  return typeof Notification !== 'undefined' && Notification.permission === 'granted';
}

export function useEventReminders(
  events: CalendarEvent[],
  user: { id: string; name: string; email?: string } | null | undefined,
  onMarkReminded: (id: string) => void,
  onMarkEmailReminded: (id: string) => void,
) {
  const reminderEmail = user ? reminderEmailForUser(user.id, user.email) : null;

  useEffect(() => {
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  useEffect(() => {
    const tick = async () => {
      const now = Date.now();

      for (const ev of events) {
        if (ev.done || ev.reminderMinutes <= 0) continue;
        const start = parseEventDateTime(ev.date, ev.time).getTime();
        if (Number.isNaN(start)) continue;
        const remindAt = start - ev.reminderMinutes * 60_000;
        if (now < remindAt || now >= start + 60_000) continue;

        if (!ev.remindedAt && mayNotify()) {
          void showLocalNotification(`${COMPANY_NAME} — Recordatorio`, {
            body: `${ev.title} · ${ev.time}`,
            tag: ev.id,
          });
          onMarkReminded(ev.id);
        }

        if (!ev.emailRemindedAt && reminderEmail && user) {
          const result = await sendCalendarReminderEmail({
            userId: user.id,
            userName: user.name,
            email: user.email,
            event: ev,
          });
          if (result.ok) {
            onMarkEmailReminded(ev.id);
          }
        }
      }
    };

    void tick();
    const id = window.setInterval(() => {
      void tick();
    }, 30_000);
    return () => window.clearInterval(id);
  }, [events, user, reminderEmail, onMarkReminded, onMarkEmailReminded]);
}
