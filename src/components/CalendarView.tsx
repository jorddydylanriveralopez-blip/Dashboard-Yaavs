import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useApp } from '../context/AppContext';
import { REMINDER_OPTIONS } from '../constants';
import { reminderEmailForUser } from '../api/calendar';
import {
  fetchGoogleAuthUrl,
  fetchGoogleCalendarStatus,
  isApiEnabled,
  saveGoogleOAuthConfig,
  triggerGoogleCalendarSync,
  type ExternalCalendarStatus,
} from '../api/client';
import { useEventReminders } from '../hooks/useEventReminders';
import {
  elapsedMinutesSince,
  endOfWeekSunday,
  formatDuration,
  getMonthMatrix,
  monthLabel,
  startOfWeekMonday,
  toDateKey,
} from '../utils/calendarDates';
import { parseIcsFile } from '../utils/icsImport';
import { parseOlmFile } from '../utils/olmImport';
import { SpellCheckInput, SpellCheckTextarea } from './SpellCheckField';
import { useSharedNow } from '../hooks/useSharedNow';
import type { CalendarEvent } from '../types';
import './CalendarView.css';

const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const ORLANDO_USER_ID = 'u-orlando';

export function CalendarView() {
  const {
    user,
    calendar,
    calendarStore,
    canEditAll,
    activeUsers,
    enablePushNotifications,
    addCalendarEvent,
    importExternalCalendarEvents,
    refreshSyncState,
    updateCalendarEvent,
    deleteCalendarEvent,
    toggleCalendarDone,
    startTimer,
    stopTimer,
    markEventReminded,
    markEventEmailReminded,
  } = useApp();

  const reminderEmail = user ? reminderEmailForUser(user.id, user.email) : null;
  const icsInputRef = useRef<HTMLInputElement>(null);
  const [icsStatus, setIcsStatus] = useState<string | null>(null);
  const [pushStatus, setPushStatus] = useState<string | null>(null);
  const [googleStatus, setGoogleStatus] = useState<ExternalCalendarStatus | null>(null);
  const [googleSyncing, setGoogleSyncing] = useState(false);
  const [googleMessage, setGoogleMessage] = useState<string | null>(null);
  const [googleClientId, setGoogleClientId] = useState('');
  const [googleClientSecret, setGoogleClientSecret] = useState('');
  const [googleSaving, setGoogleSaving] = useState(false);
  const [googleConnectOpen, setGoogleConnectOpen] = useState(false);
  const [googleConnectBusy, setGoogleConnectBusy] = useState(false);
  const [googleConnectError, setGoogleConnectError] = useState<string | null>(null);
  const googlePopupRef = useRef<Window | null>(null);
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [month, setMonth] = useState(() => new Date().getMonth());
  const [selectedDate, setSelectedDate] = useState(() => toDateKey(new Date()));
  const googleUserId = user?.id ?? '';
  const googleOwnerName = user?.name ?? '';
  const canConnectGoogle = Boolean(user);
  const canImportOrlandoAgenda =
    Boolean(user) &&
    (canEditAll || user?.employeeId === 'emp-orlando' || user?.id === ORLANDO_USER_ID);

  const defaultRedirectUri =
    typeof window !== 'undefined'
      ? `${window.location.origin}/api/google/callback`
      : 'https://darkred-wasp-801635.hostingersite.com/api/google/callback';

  const refreshGoogleStatus = async () => {
    if (!googleUserId) return null;
    const status = await fetchGoogleCalendarStatus(googleUserId);
    setGoogleStatus(status);
    return status;
  };

  const focusCurrentWeek = () => {
    const now = new Date();
    setYear(now.getFullYear());
    setMonth(now.getMonth());
    setSelectedDate(toDateKey(now));
  };

  const pullGoogleAgendaIntoDashboard = async () => {
    try {
      await refreshSyncState();
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    if (!canConnectGoogle || !googleUserId || !isApiEnabled()) return;
    let cancelled = false;
    void (async () => {
      const status = await refreshGoogleStatus();
      if (cancelled || !status?.connected) return;
      const localGoogle =
        calendarStore[googleUserId]?.events?.filter((e) => e.source === 'google').length ?? 0;
      if (localGoogle > 0) return;
      const sync = await triggerGoogleCalendarSync(googleUserId);
      if (cancelled || !sync.ok) return;
      await pullGoogleAgendaIntoDashboard();
      if (!cancelled) await refreshGoogleStatus();
    })();
    const id = window.setInterval(() => {
      void refreshGoogleStatus();
    }, 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [canConnectGoogle, googleUserId]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const data = event.data as { type?: string; ok?: boolean } | null;
      if (!data || data.type !== 'yaavs-google-oauth') return;
      setGoogleConnectBusy(false);
      void (async () => {
        const uid = googleUserId || ORLANDO_USER_ID;
        await triggerGoogleCalendarSync(uid);
        await pullGoogleAgendaIntoDashboard();
        const status = await refreshGoogleStatus();
        if (status?.connected) {
          focusCurrentWeek();
          setGoogleMessage(
            `Google Calendar conectado${
              status.eventCount != null ? ` · ${status.eventCount} eventos` : ''
            }.`,
          );
          setGoogleConnectOpen(false);
        } else if (data.ok === false) {
          setGoogleConnectError('No se pudo completar el acceso con Google.');
        }
      })();
    };
    window.addEventListener('message', onMessage);

    const params = new URLSearchParams(window.location.search);
    const googleFlag = params.get('google');
    if (googleFlag === 'connected' || googleFlag === 'error') {
      void (async () => {
        if (googleFlag === 'connected') {
          const uid = googleUserId || ORLANDO_USER_ID;
          await triggerGoogleCalendarSync(uid);
          await pullGoogleAgendaIntoDashboard();
          focusCurrentWeek();
          const status = await refreshGoogleStatus();
          if (status?.connected) {
            setGoogleMessage(
              `Agenda sincronizada${
                status.eventCount != null ? ` · ${status.eventCount} eventos` : ''
              }.`,
            );
          }
        } else {
          setGoogleConnectError('No se pudo completar el acceso con Google.');
        }
        window.history.replaceState({}, '', '/agenda');
      })();
    }

    try {
      const raw = localStorage.getItem('yaavs-google-oauth-result');
      if (raw) {
        localStorage.removeItem('yaavs-google-oauth-result');
        const parsed = JSON.parse(raw) as { type?: string; ok?: boolean };
        if (parsed?.type === 'yaavs-google-oauth') {
          window.postMessage(parsed, window.location.origin);
        }
      }
    } catch {
      /* ignore */
    }

    return () => window.removeEventListener('message', onMessage);
  }, [googleUserId]);

  const openGooglePopup = (url: string) => {
    const width = 520;
    const height = 720;
    const left = Math.max(0, Math.round(window.screenX + (window.outerWidth - width) / 2));
    const top = Math.max(0, Math.round(window.screenY + (window.outerHeight - height) / 2));
    const features = `popup=yes,width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`;
    const popup = window.open(url, 'yaavs_google_oauth', features);
    googlePopupRef.current = popup;
    return popup;
  };

  const connectGoogleCalendar = async () => {
    if (!googleUserId) {
      setGoogleConnectError('Inicia sesión para vincular tu Gmail.');
      return;
    }
    setGoogleMessage(null);
    setGoogleConnectError(null);
    setGoogleConnectOpen(true);
    setGoogleConnectBusy(true);

    const result = await fetchGoogleAuthUrl(googleUserId, { ownerName: googleOwnerName });
    if (!result.ok || !result.url) {
      setGoogleConnectBusy(false);
      setGoogleConnectError(result.error || 'No se pudo preparar el acceso a Google.');
      return;
    }

    const popup = openGooglePopup(result.url);
    if (!popup) {
      setGoogleConnectBusy(false);
      setGoogleConnectError(
        'El navegador bloqueó la ventana de Google. Permite ventanas emergentes para este sitio e inténtalo de nuevo.',
      );
      return;
    }

    const poll = window.setInterval(() => {
      if (popup.closed) {
        window.clearInterval(poll);
        setGoogleConnectBusy(false);
        void refreshGoogleStatus().then(async (status) => {
          if (status?.connected) {
            await triggerGoogleCalendarSync(googleUserId);
            await pullGoogleAgendaIntoDashboard();
            const synced = await refreshGoogleStatus();
            setGoogleMessage(
              `Google Calendar conectado${
                synced?.eventCount != null ? ` · ${synced.eventCount} eventos` : ''
              }.`,
            );
            setGoogleConnectOpen(false);
          } else {
            setGoogleConnectError(
              'Cerraste la ventana sin completar el acceso. Vuelve a intentarlo con tu cuenta de Gmail.',
            );
          }
        });
      }
    }, 700);
  };

  const syncGoogleNow = async () => {
    if (!googleUserId) return;
    setGoogleSyncing(true);
    setGoogleMessage(null);
    const result = await triggerGoogleCalendarSync(googleUserId);
    if (result.ok) {
      await pullGoogleAgendaIntoDashboard();
      focusCurrentWeek();
    }
    const status = await fetchGoogleCalendarStatus(googleUserId);
    setGoogleStatus(status);
    setGoogleSyncing(false);
    setGoogleMessage(
      result.ok
        ? `Agenda sincronizada${result.eventCount != null ? ` · ${result.eventCount} eventos` : ''} (esta semana + ~4 meses)`
        : result.error || 'No se pudo sincronizar',
    );
  };

  const saveGoogleConfig = async () => {
    setGoogleSaving(true);
    setGoogleMessage(null);
    const result = await saveGoogleOAuthConfig({
      clientId: googleClientId.trim(),
      clientSecret: googleClientSecret.trim(),
      redirectUri: defaultRedirectUri,
    });
    const status = googleUserId ? await fetchGoogleCalendarStatus(googleUserId) : null;
    setGoogleStatus(status);
    setGoogleSaving(false);
    if (result.ok) {
      setGoogleClientSecret('');
      setGoogleMessage('Credenciales guardadas. Ya puedes conectar tu Google Calendar.');
    } else {
      setGoogleMessage(result.error || 'No se pudieron guardar');
    }
  };

  const [title, setTitle] = useState('');
  const [time, setTime] = useState('09:00');
  const [reminderMinutes, setReminderMinutes] = useState(30);
  const [estimatedMinutes, setEstimatedMinutes] = useState(60);
  const [notes, setNotes] = useState('');

  useEventReminders(calendar.events, user, markEventReminded, markEventEmailReminded);

  const tickNow = useSharedNow(Boolean(calendar.activeTimer));
  void tickNow;

  const matrix = useMemo(() => getMonthMatrix(year, month), [year, month]);

  const activeEvents = useMemo(
    () => calendar.events.filter((e) => !e.done),
    [calendar.events],
  );

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const ev of activeEvents) {
      const list = map.get(ev.date) ?? [];
      list.push(ev);
      map.set(ev.date, list);
    }
    return map;
  }, [activeEvents]);

  /** Eventos compartidos de todos los colaboradores (para vista de equipo). */
  const teamEvents = useMemo(() => {
    if (!user) return [] as CalendarEvent[];
    const nameById = new Map(activeUsers.map((u) => [u.id, u.name]));
    const list: CalendarEvent[] = [];
    for (const [uid, state] of Object.entries(calendarStore)) {
      if (uid === user.id) continue;
      for (const ev of state.events) {
        if (ev.done) continue;
        if (ev.shared === false) continue;
        list.push({
          ...ev,
          ownerName: ev.ownerName ?? nameById.get(uid) ?? uid,
        });
      }
    }
    return list.sort((a, b) =>
      `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`),
    );
  }, [calendarStore, user, activeUsers]);

  const teamByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const ev of teamEvents) {
      const list = map.get(ev.date) ?? [];
      list.push(ev);
      map.set(ev.date, list);
    }
    return map;
  }, [teamEvents]);

  const dayEvents = eventsByDate.get(selectedDate) ?? [];
  const dayTeamEvents = teamByDate.get(selectedDate) ?? [];

  /** Agenda compartida de Orlando (para que el equipo vea si está disponible). */
  const orlandoEvents = useMemo(() => {
    const state = calendarStore[ORLANDO_USER_ID];
    if (!state) return [] as CalendarEvent[];
    return state.events
      .filter((e) => !e.done && e.shared !== false)
      .map((e) => ({
        ...e,
        ownerName: e.ownerName ?? 'Orlando Villagómez',
      }))
      .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));
  }, [calendarStore]);

  const orlandoByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const ev of orlandoEvents) {
      const list = map.get(ev.date) ?? [];
      list.push(ev);
      map.set(ev.date, list);
    }
    return map;
  }, [orlandoEvents]);

  const orlandoDayEvents = orlandoByDate.get(selectedDate) ?? [];
  const orlandoBusyToday = orlandoDayEvents.length > 0;

  const weekRange = useMemo(() => {
    const now = new Date();
    return {
      startKey: toDateKey(startOfWeekMonday(now)),
      endKey: toDateKey(endOfWeekSunday(now)),
      todayKey: toDateKey(now),
    };
  }, [orlandoEvents.length, googleStatus?.lastSyncAt, googleMessage]);

  /** Esta semana + siguientes: agenda compartida de todo el equipo (incl. la tuya). */
  const teamAgendaEvents = useMemo(() => {
    const nameById = new Map(activeUsers.map((u) => [u.id, u.name]));
    const list: CalendarEvent[] = [];
    for (const [uid, state] of Object.entries(calendarStore)) {
      for (const ev of state.events) {
        if (ev.done || ev.shared === false) continue;
        list.push({
          ...ev,
          ownerName: ev.ownerName ?? nameById.get(uid) ?? uid,
        });
      }
    }
    return list.sort((a, b) =>
      `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`),
    );
  }, [calendarStore, activeUsers]);

  const teamWeekPendings = useMemo(() => {
    return teamAgendaEvents.filter(
      (ev) => ev.date >= weekRange.startKey && ev.date <= weekRange.endKey,
    );
  }, [teamAgendaEvents, weekRange.startKey, weekRange.endKey]);

  const teamUpcomingPendings = useMemo(() => {
    return teamAgendaEvents.filter((ev) => ev.date > weekRange.endKey);
  }, [teamAgendaEvents, weekRange.endKey]);

  const teamUpcomingByMonth = useMemo(() => {
    const groups: { monthKey: string; label: string; events: CalendarEvent[] }[] = [];
    const byMonth = new Map<string, CalendarEvent[]>();
    for (const ev of teamUpcomingPendings) {
      const monthKey = ev.date.slice(0, 7);
      const list = byMonth.get(monthKey) ?? [];
      list.push(ev);
      byMonth.set(monthKey, list);
    }
    for (const [monthKey, events] of byMonth) {
      const [y, m] = monthKey.split('-').map(Number);
      groups.push({
        monthKey,
        label: new Date(y, m - 1, 1).toLocaleDateString('es-MX', {
          month: 'long',
          year: 'numeric',
        }),
        events,
      });
    }
    return groups;
  }, [teamUpcomingPendings]);

  const teamAgendaCount = teamWeekPendings.length + teamUpcomingPendings.length;

  const isInCurrentWeek = (dateKey: string) =>
    dateKey >= weekRange.startKey && dateKey <= weekRange.endKey;

  const openTeamPending = (ev: CalendarEvent) => {
    setSelectedDate(ev.date);
    const [y, m] = ev.date.split('-').map(Number);
    setYear(y);
    setMonth(m - 1);
  };

  const activeEvent = calendar.activeTimer
    ? calendar.events.find((e) => e.id === calendar.activeTimer?.eventId)
    : null;

  const liveExtra = calendar.activeTimer
    ? elapsedMinutesSince(calendar.activeTimer.startedAt)
    : 0;

  const monthTotalTracked = useMemo(() => {
    const prefix = `${year}-${String(month + 1).padStart(2, '0')}`;
    return activeEvents
      .filter((e) => e.date.startsWith(prefix))
      .reduce((sum, e) => {
        let mins = e.trackedMinutes;
        if (calendar.activeTimer?.eventId === e.id) {
          mins += liveExtra;
        }
        return sum + mins;
      }, 0);
  }, [activeEvents, calendar.activeTimer, year, month, liveExtra]);

  const shiftMonth = (delta: number) => {
    const d = new Date(year, month + delta, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
  };

  const handleAdd = (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    addCalendarEvent({
      title: title.trim(),
      date: selectedDate,
      time,
      reminderMinutes,
      estimatedMinutes,
      notes: notes.trim(),
      kind: 'event',
      shared: true,
    });
    setTitle('');
    setNotes('');
  };

  const handleMarkBusy = () => {
    addCalendarEvent({
      title: 'Día ocupado',
      date: selectedDate,
      time: time || '09:00',
      reminderMinutes: 0,
      estimatedMinutes: 0,
      notes: notes.trim() || 'No disponible',
      kind: 'busy',
      shared: true,
    });
    setNotes('');
  };

  const handleCalendarFileImport = async (file: File | null) => {
    if (!file) return;
    if (!canImportOrlandoAgenda) {
      setIcsStatus('Solo Orlando o un líder pueden importar la agenda de Outlook.');
      return;
    }
    setIcsStatus('Importando agenda…');
    try {
      const lower = file.name.toLowerCase();
      let count = 0;
      if (lower.endsWith('.olm') || lower.endsWith('.xml')) {
        const imported = await parseOlmFile(file);
        if (imported.length === 0) {
          setIcsStatus('No se encontraron citas en el archivo Outlook.');
          return;
        }
        count = importExternalCalendarEvents(
          ORLANDO_USER_ID,
          imported.map((item) => ({
            title: item.title,
            date: item.date,
            time: item.time,
            reminderMinutes: 15,
            estimatedMinutes: item.estimatedMinutes,
            notes: item.notes,
            kind: item.kind === 'event' ? 'busy' : item.kind, // citas Outlook = ocupado para el equipo
            shared: true,
            ownerName: 'Orlando Villagómez',
            source: 'outlook' as const,
            externalId: item.externalId,
          })),
          'outlook',
        );
        setIcsStatus(
          `Listo: ${count} evento(s) de Outlook en la agenda de Orlando. El equipo ya puede ver su disponibilidad.`,
        );
      } else {
        const imported = await parseIcsFile(file);
        if (imported.length === 0) {
          setIcsStatus('No se encontraron eventos en el archivo.');
          return;
        }
        count = importExternalCalendarEvents(
          ORLANDO_USER_ID,
          imported.map((item) => ({
            title: item.title,
            date: item.date,
            time: item.time,
            reminderMinutes: 30,
            estimatedMinutes: 60,
            notes: item.notes
              ? `${item.notes}\n(Importado desde correo)`
              : 'Importado desde correo',
            kind: 'busy' as const,
            shared: true,
            ownerName: 'Orlando Villagómez',
            source: 'ics' as const,
          })),
          'ics',
        );
        setIcsStatus(`Se importaron ${count} evento(s) a la agenda de Orlando.`);
      }
    } catch (err) {
      setIcsStatus(
        err instanceof Error
          ? err.message
          : 'No se pudo leer el archivo. Usa un .olm de Outlook o un .ics.',
      );
    } finally {
      if (icsInputRef.current) icsInputRef.current.value = '';
    }
  };

  const requestNotify = async () => {
    setPushStatus('Activando…');
    const result = await enablePushNotifications();
    if (result.ok) {
      setPushStatus('Listo: este dispositivo recibirá avisos de agenda al instante.');
      return;
    }
    if (result.reason === 'no-vapid') {
      setPushStatus(
        'Falta configurar VITE_VAPID_PUBLIC_KEY en el servidor. Mientras tanto, Orlando recibe correo.',
      );
      return;
    }
    if (result.reason === 'denied' || result.reason === 'default') {
      setPushStatus('Permiso de notificaciones denegado. Actívalo en el navegador.');
      return;
    }
    setPushStatus('No se pudieron activar las notificaciones en este dispositivo.');
  };

  return (
    <div className="calendar-view">
      <div className="calendar-layout">
        <section className="calendar-panel">
          <div className="calendar-panel-head">
            <button type="button" className="btn-ghost" onClick={() => shiftMonth(-1)}>
              ‹
            </button>
            <h2>{monthLabel(year, month)}</h2>
            <button type="button" className="btn-ghost" onClick={() => shiftMonth(1)}>
              ›
            </button>
          </div>

          <div className="calendar-weekdays">
            {WEEKDAYS.map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>

          <div className="calendar-grid">
            {matrix.flat().map((cell, i) => {
              if (!cell) {
                return <span key={`empty-${i}`} className="calendar-day empty" />;
              }
              const key = toDateKey(cell);
              const ownCount = eventsByDate.get(key)?.length ?? 0;
              const teamDay = teamByDate.get(key) ?? [];
              const teamCount = teamDay.length;
              const orlandoDay = orlandoByDate.get(key) ?? [];
              const orlandoCount = orlandoDay.length;
              const teamPreview = teamDay.slice(0, 2);
              const isSelected = key === selectedDate;
              const isToday = key === toDateKey(new Date());
              return (
                <button
                  key={key}
                  type="button"
                  className={`calendar-day ${isSelected ? 'selected' : ''} ${isToday ? 'today' : ''} ${orlandoCount > 0 ? 'has-orlando' : ''} ${teamCount > 0 && orlandoCount === 0 ? 'has-team' : ''} ${isInCurrentWeek(key) ? 'in-week' : ''}`}
                  onClick={() => setSelectedDate(key)}
                  title={
                    teamCount > 0
                      ? teamDay
                          .map((e) => `${e.time} ${e.title} (${e.ownerName ?? ''})`)
                          .join('\n')
                      : undefined
                  }
                >
                  <span className="day-num">{cell.getDate()}</span>
                  {teamPreview.length > 0 && (
                    <span className="day-orlando-events">
                      {teamPreview.map((ev) => (
                        <span key={`${ev.userId}-${ev.id}`} className="day-orlando-chip">
                          <span className="day-orlando-time">{ev.time}</span>
                          <span className="day-orlando-name">
                            {ev.ownerName ? `${ev.ownerName.split(' ')[0]} · ` : ''}
                            {ev.title}
                          </span>
                        </span>
                      ))}
                      {teamCount > 2 && (
                        <span className="day-orlando-more">+{teamCount - 2} más</span>
                      )}
                    </span>
                  )}
                  {(ownCount > 0 || teamCount > 0) && (
                    <span className="day-dots-row" aria-hidden>
                      {ownCount > 0 && <span className="day-dot day-dot--own" />}
                      {orlandoCount > 0 && <span className="day-dot day-dot--orlando" />}
                      {teamCount > orlandoCount && <span className="day-dot day-dot--team" />}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="calendar-summary">
            <p>
              <strong>Tiempo registrado este mes:</strong>{' '}
              {formatDuration(monthTotalTracked)}
            </p>
            <p className="calendar-legend">
              <span className="day-dot day-dot--own" /> Tuyos{' '}
              <span className="day-dot day-dot--orlando" /> Orlando{' '}
              <span className="day-dot day-dot--team" /> Equipo
            </p>
            <button type="button" className="btn-ghost notify-btn" onClick={() => void requestNotify()}>
              Activar notificaciones
            </button>
            {pushStatus && <p className="calendar-push-status">{pushStatus}</p>}
          </div>
        </section>

        <section className="calendar-side">
          <header className="calendar-side-head">
            <h2>
              {new Date(`${selectedDate}T12:00:00`).toLocaleDateString('es-MX', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
              })}
            </h2>
            <p className="calendar-user">Agenda de {user?.name}</p>
            <p className="calendar-hint">
              Al marcar un pendiente como hecho, desaparece de la agenda.
              {reminderEmail && (
                <>
                  {' '}
                  Los recordatorios también llegan a <strong>{reminderEmail}</strong>.
                </>
              )}
            </p>
          </header>

          {activeEvent && calendar.activeTimer && (
            <div className="timer-banner">
              <div>
                <strong>Cronómetro activo</strong>
                <span>{activeEvent.title}</span>
              </div>
              <div className="timer-banner-actions">
                <span className="timer-live">
                  +{formatDuration(liveExtra)} (
                  {formatDuration(activeEvent.trackedMinutes + liveExtra)} total)
                </span>
                <button type="button" className="btn-primary" onClick={stopTimer}>
                  Detener
                </button>
              </div>
            </div>
          )}

          <form className="calendar-form" onSubmit={handleAdd}>
            <h3>Nuevo pendiente</h3>
            <label>
              Título
              <SpellCheckInput
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ej. Revisar creativos de campaña"
                required
              />
            </label>
            <div className="calendar-form-row">
              <label>
                Hora
                <input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  required
                />
              </label>
              <label>
                Tiempo estimado (min)
                <input
                  type="number"
                  min={5}
                  step={5}
                  value={estimatedMinutes}
                  onChange={(e) => setEstimatedMinutes(Number(e.target.value) || 60)}
                />
              </label>
            </div>
            <label>
              Recordatorio
              <select
                value={reminderMinutes}
                onChange={(e) => setReminderMinutes(Number(e.target.value))}
              >
                {REMINDER_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Notas
              <SpellCheckTextarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Detalles opcionales…"
              />
            </label>
            <div className="calendar-form-actions">
              <button type="submit" className="btn-primary">
                Agregar pendiente
              </button>
              <button type="button" className="btn-ghost" onClick={handleMarkBusy}>
                Marcar día ocupado
              </button>
            </div>
          </form>

          <div className="calendar-ics">
            <h3>Mi Google Calendar</h3>
            {canConnectGoogle ? (
              <>
                <p>
                  Vincula tu Gmail ({user?.name ?? 'tú'}) para sincronizar esta semana y ~4 meses.
                  El equipo verá tus pendientes marcados en el calendario.
                </p>
                {!isApiEnabled() ? (
                  <p className="calendar-ics-status">Activa la API para conectar Google Calendar.</p>
                ) : !googleStatus ? (
                  <p className="calendar-ics-status">
                    No se pudo leer el estado de Google. Espera el redeploy o revisa que exista{' '}
                    <code>/api/google/status</code>.
                  </p>
                ) : !googleStatus.configured ? (
                  canEditAll ? (
                    <div className="calendar-google-setup">
                      <p className="calendar-ics-status">
                        Hostinger borra las variables del panel. Pega aquí el Client ID y Secret una
                        vez; se guardan en la base de datos.
                      </p>
                      <label>
                        Client ID
                        <input
                          value={googleClientId}
                          onChange={(e) => setGoogleClientId(e.target.value)}
                          placeholder="xxxxx.apps.googleusercontent.com"
                          autoComplete="off"
                        />
                      </label>
                      <label>
                        Client Secret
                        <input
                          type="password"
                          value={googleClientSecret}
                          onChange={(e) => setGoogleClientSecret(e.target.value)}
                          placeholder="GOCSPX-..."
                          autoComplete="off"
                        />
                      </label>
                      <p className="calendar-ics-status">
                        Redirect URI (agrégalo también en Google Cloud):{' '}
                        <code>{defaultRedirectUri}</code>
                      </p>
                      <button
                        type="button"
                        className="btn-primary"
                        disabled={
                          googleSaving || !googleClientId.trim() || !googleClientSecret.trim()
                        }
                        onClick={() => void saveGoogleConfig()}
                      >
                        {googleSaving ? 'Guardando…' : 'Guardar credenciales'}
                      </button>
                    </div>
                  ) : (
                    <p className="calendar-ics-status">
                      Un líder debe configurar las credenciales de Google una vez. Luego tú podrás
                      vincular tu Gmail.
                    </p>
                  )
                ) : googleStatus.connected ? (
                  <>
                    <p className="calendar-ics-status">
                      Conectado{googleStatus.email ? ` · ${googleStatus.email}` : ''}
                      {googleStatus.lastSyncAt
                        ? ` · Última sync ${new Date(googleStatus.lastSyncAt).toLocaleString('es-MX')}`
                        : ''}
                    </p>
                    {googleStatus.lastError && (
                      <p className="calendar-ics-status">{googleStatus.lastError}</p>
                    )}
                    <button
                      type="button"
                      className="btn-primary"
                      disabled={googleSyncing}
                      onClick={() => void syncGoogleNow()}
                    >
                      {googleSyncing ? 'Sincronizando…' : 'Sincronizar ahora'}
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => void connectGoogleCalendar()}
                  >
                    Conectar mi Google Calendar
                  </button>
                )}
                {googleMessage && <p className="calendar-ics-status">{googleMessage}</p>}
              </>
            ) : (
              <p>Inicia sesión para vincular tu agenda de Gmail.</p>
            )}
          </div>

          {canImportOrlandoAgenda && (
            <div className="calendar-ics">
              <h3>Importar agenda de Orlando (Outlook)</h3>
              <p>
                Sube el archivo <code>.olm</code> de Outlook para Mac (o un <code>.ics</code>) para
                sincronizar la agenda de Orlando. El equipo verá si está ocupado o disponible.
              </p>
              <input
                ref={icsInputRef}
                type="file"
                accept=".olm,.ics,.xml,text/calendar,application/zip"
                className="calendar-ics-input"
                onChange={(e) => void handleCalendarFileImport(e.target.files?.[0] ?? null)}
              />
              {icsStatus && <p className="calendar-ics-status">{icsStatus}</p>}
            </div>
          )}

          <div
            className={`calendar-orlando ${orlandoBusyToday ? 'busy' : 'free'}`}
            aria-label="Disponibilidad de Orlando"
          >
            <h3>Orlando · {orlandoBusyToday ? 'Ocupado' : 'Disponible'}</h3>
            {orlandoDayEvents.length === 0 ? (
              <p className="calendar-orlando-status calendar-orlando-status--free">
                Sin eventos este día — Orlando parece disponible.
              </p>
            ) : (
              <>
                <p className="calendar-orlando-status calendar-orlando-status--busy">
                  Orlando Villagómez · {orlandoDayEvents.length} evento
                  {orlandoDayEvents.length === 1 ? '' : 's'}
                </p>
                <ul className="calendar-orlando-list">
                  {orlandoDayEvents.map((ev) => (
                    <li key={ev.id}>
                      <strong>{ev.time}</strong>
                      <span>
                        {ev.title}
                        {ev.estimatedMinutes > 0
                          ? ` · ${formatDuration(ev.estimatedMinutes)}`
                          : ''}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>

          <div className="calendar-orlando-week" aria-label="Pendientes del equipo">
            <h3>Pendientes del equipo ({teamAgendaCount})</h3>
            <p className="calendar-orlando-week-hint">
              Todos los colaboradores (Orlando, Jorddy, etc.). Esta semana y ~4 meses adelante.
            </p>

            <h4 className="calendar-orlando-week-sub">
              Esta semana ({teamWeekPendings.length})
            </h4>
            {teamWeekPendings.length === 0 ? (
              <p className="calendar-empty">Sin eventos compartidos esta semana.</p>
            ) : (
              <ul className="calendar-orlando-week-list">
                {teamWeekPendings.map((ev) => {
                  const isPastOrToday = ev.date <= weekRange.todayKey;
                  return (
                    <li key={`${ev.userId}-${ev.id}`}>
                      <button
                        type="button"
                        className={`calendar-orlando-week-item ${isPastOrToday ? 'is-due' : ''} ${ev.date === selectedDate ? 'is-selected' : ''}`}
                        onClick={() => openTeamPending(ev)}
                      >
                        <span className="calendar-orlando-week-when">
                          {new Date(`${ev.date}T12:00:00`).toLocaleDateString('es-MX', {
                            weekday: 'short',
                            day: 'numeric',
                            month: 'short',
                          })}{' '}
                          · {ev.time}
                        </span>
                        <span className="calendar-orlando-week-title">{ev.title}</span>
                        <span className="calendar-orlando-week-owner">
                          {ev.ownerName ?? 'Colaborador'}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

            <h4 className="calendar-orlando-week-sub">
              Próximas semanas y meses ({teamUpcomingPendings.length})
            </h4>
            {teamUpcomingPendings.length === 0 ? (
              <p className="calendar-empty">
                No hay eventos más adelante. Cada colaborador puede vincular su Gmail y pulsar
                «Sincronizar ahora».
              </p>
            ) : (
              teamUpcomingByMonth.map((group) => (
                <div key={group.monthKey} className="calendar-orlando-month-group">
                  <p className="calendar-orlando-month-label">{group.label}</p>
                  <ul className="calendar-orlando-week-list">
                    {group.events.map((ev) => (
                      <li key={`${ev.userId}-${ev.id}`}>
                        <button
                          type="button"
                          className={`calendar-orlando-week-item ${ev.date === selectedDate ? 'is-selected' : ''}`}
                          onClick={() => openTeamPending(ev)}
                        >
                          <span className="calendar-orlando-week-when">
                            {new Date(`${ev.date}T12:00:00`).toLocaleDateString('es-MX', {
                              weekday: 'short',
                              day: 'numeric',
                              month: 'short',
                            })}{' '}
                            · {ev.time}
                          </span>
                          <span className="calendar-orlando-week-title">{ev.title}</span>
                          <span className="calendar-orlando-week-owner">
                            {ev.ownerName ?? 'Colaborador'}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))
            )}
          </div>

          <div className="calendar-events">
            <h3>Pendientes del día ({dayEvents.length})</h3>
            {dayEvents.length === 0 ? (
              <p className="calendar-empty">No hay pendientes para este día.</p>
            ) : (
              <ul>
                {dayEvents.map((ev) => (
                  <EventCard
                    key={ev.id}
                    event={ev}
                    isTimerActive={calendar.activeTimer?.eventId === ev.id}
                    liveExtra={
                      calendar.activeTimer?.eventId === ev.id ? liveExtra : 0
                    }
                    onToggleDone={() => toggleCalendarDone(ev.id)}
                    onStart={() => startTimer(ev.id)}
                    onStop={stopTimer}
                    onDelete={() => deleteCalendarEvent(ev.id)}
                    onUpdateNotes={(n) => updateCalendarEvent(ev.id, { notes: n })}
                  />
                ))}
              </ul>
            )}
          </div>

          <div className="calendar-team">
            <h3>Agenda del equipo ({dayTeamEvents.length})</h3>
            {dayTeamEvents.length === 0 ? (
              <p className="calendar-empty">Nadie más tiene eventos compartidos este día.</p>
            ) : (
              <ul className="calendar-team-list">
                {dayTeamEvents.map((ev) => (
                  <li
                    key={`${ev.userId}-${ev.id}`}
                    className={`calendar-team-item ${ev.kind === 'busy' ? 'busy' : ''}`}
                  >
                    <div className="calendar-team-top">
                      <strong>{ev.title}</strong>
                      <span>{ev.time}</span>
                    </div>
                    <p className="calendar-team-owner">
                      {ev.kind === 'busy' ? 'Ocupado · ' : ''}
                      {ev.ownerName}
                    </p>
                    {ev.notes && <p className="calendar-team-notes">{ev.notes}</p>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>

      {googleConnectOpen && (
        <div
          className="google-connect-modal-backdrop"
          role="presentation"
          onClick={() => {
            if (!googleConnectBusy) setGoogleConnectOpen(false);
          }}
        >
          <div
            className="google-connect-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="google-connect-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="google-connect-title">Conectar Google Calendar</h3>
            <p>
              Se abre una ventana de Google para que {user?.name ?? 'tú'} inicies sesión con tu
              Gmail. Esta agenda se queda abierta; no te saca del dashboard.
            </p>
            {googleConnectBusy ? (
              <p className="google-connect-modal-status">Esperando acceso en la ventana de Google…</p>
            ) : googleConnectError ? (
              <p className="google-connect-modal-error">{googleConnectError}</p>
            ) : (
              <p className="google-connect-modal-status">Listo para conectar.</p>
            )}
            <div className="google-connect-modal-actions">
              <button
                type="button"
                className="btn-ghost"
                onClick={() => {
                  try {
                    googlePopupRef.current?.close();
                  } catch {
                    /* ignore */
                  }
                  setGoogleConnectOpen(false);
                  setGoogleConnectBusy(false);
                }}
              >
                Cerrar
              </button>
              <button
                type="button"
                className="btn-primary"
                disabled={googleConnectBusy}
                onClick={() => void connectGoogleCalendar()}
              >
                {googleConnectBusy ? 'Conectando…' : 'Reintentar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EventCard({
  event,
  isTimerActive,
  liveExtra,
  onToggleDone,
  onStart,
  onStop,
  onDelete,
  onUpdateNotes,
}: {
  event: CalendarEvent;
  isTimerActive: boolean;
  liveExtra: number;
  onToggleDone: () => void;
  onStart: () => void;
  onStop: () => void;
  onDelete: () => void;
  onUpdateNotes: (notes: string) => void;
}) {
  const isBusy = event.kind === 'busy';
  const tracked = event.trackedMinutes + (isTimerActive ? liveExtra : 0);
  const progress =
    !isBusy && event.estimatedMinutes
      ? Math.min(100, Math.round((tracked / event.estimatedMinutes) * 100))
      : 0;

  return (
    <li className={`event-card ${event.done ? 'done' : ''} ${isBusy ? 'busy' : ''}`}>
      <div className="event-card-top">
        <label className="event-check">
          <input type="checkbox" checked={event.done} onChange={onToggleDone} />
          <span>
            {isBusy && <span className="event-busy-badge">Ocupado</span>}
            {event.title}
          </span>
        </label>
        <span className="event-time">{event.time}</span>
      </div>

      {!isBusy && (
        <>
          <div className="event-time-bar">
            <div className="event-time-fill" style={{ width: `${progress}%` }} />
          </div>
          <p className="event-time-meta">
            {formatDuration(tracked)} / {formatDuration(event.estimatedMinutes)} estimado
            {event.reminderMinutes > 0 && (
              <span className="event-reminder">
                {' '}
                · Recordatorio activo
                {event.emailRemindedAt ? ' · Correo enviado' : ''}
              </span>
            )}
          </p>
        </>
      )}

      <SpellCheckTextarea
        className="event-notes"
        value={event.notes}
        placeholder="Notas…"
        rows={2}
        onChange={(e) => onUpdateNotes(e.target.value)}
      />

      <div className="event-actions">
        {!isBusy &&
          (isTimerActive ? (
            <button type="button" className="btn-primary" onClick={onStop}>
              Detener cronómetro
            </button>
          ) : (
            <button
              type="button"
              className="btn-ghost"
              onClick={onStart}
              disabled={event.done}
            >
              Iniciar tiempo
            </button>
          ))}
        <button type="button" className="btn-icon danger" onClick={onDelete} title="Eliminar">
          ×
        </button>
      </div>
    </li>
  );
}
