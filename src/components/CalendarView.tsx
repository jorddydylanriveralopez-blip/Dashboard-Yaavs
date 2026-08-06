import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useApp } from '../context/AppContext';
import { REMINDER_OPTIONS } from '../constants';
import { reminderEmailForUser } from '../api/calendar';
import {
  fetchGoogleAuthUrl,
  fetchGoogleCalendarStatus,
  fetchOutlookIcsStatus,
  isApiEnabled,
  saveGoogleOAuthConfig,
  saveOutlookIcsConfig,
  triggerGoogleCalendarSync,
  triggerOutlookIcsSync,
  type ExternalCalendarStatus,
  type OutlookIcsStatus,
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
import './CollaboratorMultiSelect.css';

const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const ORLANDO_USER_ID = 'u-orlando';

/** Minutos entre HH:MM inicio y fin (si fin ≤ inicio, asume al menos 30 min). */
function minutesBetweenTimes(start: string, end: string): number {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  if ([sh, sm, eh, em].some((n) => Number.isNaN(n))) return 60;
  let mins = eh * 60 + em - (sh * 60 + sm);
  if (mins <= 0) mins = 30;
  return mins;
}

/** Hora de fin a partir de inicio + minutos estimados. */
function endTimeFromStart(start: string, estimatedMinutes: number): string {
  const [sh, sm] = start.split(':').map(Number);
  const total = (sh * 60 + sm + Math.max(0, estimatedMinutes || 60)) % (24 * 60);
  const eh = Math.floor(total / 60);
  const em = total % 60;
  return `${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}`;
}

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
  const [outlookStatus, setOutlookStatus] = useState<OutlookIcsStatus | null>(null);
  const [outlookUrl, setOutlookUrl] = useState('');
  const [outlookBusy, setOutlookBusy] = useState(false);
  const [outlookMessage, setOutlookMessage] = useState<string | null>(null);
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
      : 'https://darkred-wasp-801835.hostingersite.com/api/google/callback';

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
    let syncing = false;
    const AUTO_SYNC_MS = 3 * 60_000;

    const autoSync = async (reason: 'mount' | 'interval' | 'focus') => {
      if (cancelled || syncing) return;
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      syncing = true;
      try {
        const status = await refreshGoogleStatus();
        if (cancelled || !status?.connected) return;
        if (reason === 'mount') setGoogleSyncing(true);
        const sync = await triggerGoogleCalendarSync(googleUserId);
        if (cancelled) return;
        if (sync.ok) {
          await pullGoogleAgendaIntoDashboard();
          if (!cancelled) {
            const next = await refreshGoogleStatus();
            if (reason === 'mount' || reason === 'focus') {
              setGoogleMessage(
                `Agenda al día${
                  next?.eventCount != null
                    ? ` · ${next.eventCount} eventos`
                    : sync.eventCount != null
                      ? ` · ${sync.eventCount} eventos`
                      : ''
                } (auto)`,
              );
            }
          }
        }
      } finally {
        syncing = false;
        if (!cancelled) setGoogleSyncing(false);
      }
    };

    void autoSync('mount');
    const id = window.setInterval(() => {
      void autoSync('interval');
    }, AUTO_SYNC_MS);

    const onVisibility = () => {
      if (document.visibilityState === 'visible') void autoSync('focus');
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelled = true;
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisibility);
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
        ? `Agenda sincronizada${result.eventCount != null ? ` · ${result.eventCount} eventos` : ''} (~2 años atrás + ~1 año)`
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

  useEffect(() => {
    if (!canImportOrlandoAgenda || !isApiEnabled()) return;
    let cancelled = false;
    void (async () => {
      const status = await fetchOutlookIcsStatus(ORLANDO_USER_ID);
      if (!cancelled) setOutlookStatus(status);
      if (status?.configured && !cancelled) {
        const sync = await triggerOutlookIcsSync(ORLANDO_USER_ID);
        if (sync.ok) {
          await pullGoogleAgendaIntoDashboard();
          const next = await fetchOutlookIcsStatus(ORLANDO_USER_ID);
          if (!cancelled) {
            setOutlookStatus(next);
            setOutlookMessage(
              `Outlook al día${sync.eventCount != null ? ` · ${sync.eventCount} eventos` : ''}`,
            );
          }
        }
      }
    })();
    const id = window.setInterval(() => {
      void (async () => {
        const status = await fetchOutlookIcsStatus(ORLANDO_USER_ID);
        if (cancelled || !status?.configured) return;
        const sync = await triggerOutlookIcsSync(ORLANDO_USER_ID);
        if (cancelled || !sync.ok) return;
        await pullGoogleAgendaIntoDashboard();
        if (!cancelled) setOutlookStatus(await fetchOutlookIcsStatus(ORLANDO_USER_ID));
      })();
    }, 5 * 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [canImportOrlandoAgenda]);

  const saveOutlookLink = async () => {
    if (!outlookUrl.trim()) {
      setOutlookMessage('Pega el enlace ICS publicado de Outlook / Hotmail.');
      return;
    }
    setOutlookBusy(true);
    setOutlookMessage(null);
    const result = await saveOutlookIcsConfig({
      url: outlookUrl.trim(),
      userId: ORLANDO_USER_ID,
    });
    const status = await fetchOutlookIcsStatus(ORLANDO_USER_ID);
    setOutlookStatus(status);
    if (result.ok) {
      await pullGoogleAgendaIntoDashboard();
      setOutlookUrl('');
      setOutlookMessage(
        `Outlook conectado${result.eventCount != null ? ` · ${result.eventCount} eventos` : ''}. Se actualiza solo.`,
      );
    } else {
      setOutlookMessage(result.error || 'No se pudo guardar el enlace');
    }
    setOutlookBusy(false);
  };

  const syncOutlookNow = async () => {
    setOutlookBusy(true);
    setOutlookMessage(null);
    const result = await triggerOutlookIcsSync(ORLANDO_USER_ID);
    if (result.ok) await pullGoogleAgendaIntoDashboard();
    setOutlookStatus(await fetchOutlookIcsStatus(ORLANDO_USER_ID));
    setOutlookBusy(false);
    setOutlookMessage(
      result.ok
        ? `Outlook sincronizado${result.eventCount != null ? ` · ${result.eventCount} eventos` : ''}`
        : result.error || 'No se pudo sincronizar Outlook',
    );
  };

  const [title, setTitle] = useState('');
  const [time, setTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [reminderMinutes, setReminderMinutes] = useState(30);
  const [notes, setNotes] = useState('');
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [dayModalOpen, setDayModalOpen] = useState(false);

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

  const dayEvents = eventsByDate.get(selectedDate) ?? [];

  const weekRange = useMemo(() => {
    const now = new Date();
    return {
      startKey: toDateKey(startOfWeekMonday(now)),
      endKey: toDateKey(endOfWeekSunday(now)),
      todayKey: toDateKey(now),
    };
  }, [activeEvents.length, googleStatus?.lastSyncAt, googleMessage]);

  const isOrlandoViewer =
    user?.id === ORLANDO_USER_ID || user?.employeeId === 'emp-orlando';

  /** Agenda ocupada de Orlando (visible para el equipo en el día seleccionado). */
  const orlandoDayEvents = useMemo(() => {
    const events = calendarStore[ORLANDO_USER_ID]?.events ?? [];
    return events
      .filter((ev) => !ev.done && ev.date === selectedDate)
      .sort((a, b) => a.time.localeCompare(b.time));
  }, [calendarStore, selectedDate]);

  const orlandoBusyToday = orlandoDayEvents.length > 0;

  const orlandoByDate = useMemo(() => {
    const map = new Map<string, number>();
    for (const ev of calendarStore[ORLANDO_USER_ID]?.events ?? []) {
      if (ev.done) continue;
      map.set(ev.date, (map.get(ev.date) ?? 0) + 1);
    }
    return map;
  }, [calendarStore]);

  const isInCurrentWeek = (dateKey: string) =>
    dateKey >= weekRange.startKey && dateKey <= weekRange.endKey;

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
    const selectedMembers = activeUsers.filter((u) => memberIds.includes(u.id));
    addCalendarEvent({
      title: title.trim(),
      date: selectedDate,
      time,
      reminderMinutes,
      estimatedMinutes: minutesBetweenTimes(time, endTime),
      notes: notes.trim(),
      kind: 'event',
      shared: false,
      memberIds: selectedMembers.map((u) => u.id),
      memberNames: selectedMembers.map((u) => u.name),
    });
    setTitle('');
    setNotes('');
    setMemberIds([]);
  };

  const handleMarkBusy = () => {
    addCalendarEvent({
      title: 'Día ocupado',
      date: selectedDate,
      time: time || '09:00',
      reminderMinutes: 0,
      estimatedMinutes: minutesBetweenTimes(time || '09:00', endTime || '18:00'),
      notes: notes.trim() || 'No disponible',
      kind: 'busy',
      shared: false,
    });
    setNotes('');
  };

  const selectDay = (dateKey: string) => {
    setSelectedDate(dateKey);
    setDayModalOpen(true);
  };

  useEffect(() => {
    if (!dayModalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDayModalOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dayModalOpen]);

  const modalDayLabel = new Date(`${selectedDate}T12:00:00`).toLocaleDateString('es-MX', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });


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
            kind: item.kind === 'event' ? 'busy' : item.kind,
            shared: false,
            ownerName: 'Orlando Villagómez',
            source: 'outlook' as const,
            externalId: item.externalId,
          })),
          'outlook',
        );
        setIcsStatus(
          `Listo: ${count} evento(s) de Outlook en la agenda privada de Orlando.`,
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
            shared: false,
            ownerName: 'Orlando Villagómez',
            source: 'ics' as const,
          })),
          'ics',
        );
        setIcsStatus(`Se importaron ${count} evento(s) a la agenda privada de Orlando.`);
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
        'No se pudo activar push todavía. Espera el redeploy o recarga en unos minutos.',
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
              const ownDay = eventsByDate.get(key) ?? [];
              const ownCount = ownDay.length;
              const isSelected = key === selectedDate;
              const ownPreview = isSelected ? ownDay.slice(0, 4) : ownDay.slice(0, 2);
              const orlandoCount = isOrlandoViewer ? 0 : orlandoByDate.get(key) ?? 0;
              const isToday = key === toDateKey(new Date());
              return (
                <button
                  key={key}
                  type="button"
                  className={`calendar-day ${isSelected ? 'selected is-expanded' : ''} ${isToday ? 'today' : ''} ${ownCount > 0 ? 'has-own' : ''} ${orlandoCount > 0 ? 'has-orlando' : ''} ${isInCurrentWeek(key) ? 'in-week' : ''}`}
                  onClick={() => selectDay(key)}
                  title={
                    ownCount > 0
                      ? ownDay.map((e) => `${e.time} ${e.title}`).join('\n')
                      : orlandoCount > 0
                        ? `Orlando: ${orlandoCount} evento(s)`
                        : undefined
                  }
                >
                  <span className="day-num">{cell.getDate()}</span>
                  {ownPreview.length > 0 && (
                    <span className="day-orlando-events">
                      {ownPreview.map((ev) => (
                        <span key={ev.id} className="day-orlando-chip">
                          <span className="day-orlando-time">{ev.time}</span>
                          <span className="day-orlando-name">{ev.title}</span>
                        </span>
                      ))}
                      {ownCount > ownPreview.length && (
                        <span className="day-orlando-more">
                          +{ownCount - ownPreview.length} más
                        </span>
                      )}
                    </span>
                  )}
                  {(ownCount > 0 || orlandoCount > 0) && (
                    <span className="day-dots-row" aria-hidden>
                      {ownCount > 0 && <span className="day-dot day-dot--own" />}
                      {orlandoCount > 0 && <span className="day-dot day-dot--orlando" />}
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
              <span className="day-dot day-dot--own" /> Tus pendientes
              {!isOrlandoViewer && (
                <>
                  {' '}
                  <span className="day-dot day-dot--orlando" /> Orlando ocupado
                </>
              )}
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
                Hora de inicio
                <input
                  type="time"
                  value={time}
                  onChange={(e) => {
                    const next = e.target.value;
                    setTime(next);
                    if (minutesBetweenTimes(next, endTime) <= 0) {
                      setEndTime(endTimeFromStart(next, 60));
                    }
                  }}
                  required
                />
              </label>
              <label>
                Hora finalizada
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  required
                />
              </label>
            </div>
            <fieldset className="calendar-members">
              <legend>Integrantes</legend>
              <p className="calendar-members-hint">
                Elige uno o más colaboradores (opcional).
              </p>
              <div className="collab-multi">
                <label className="collab-multi-option collab-multi-option--all">
                  <input
                    type="checkbox"
                    checked={
                      activeUsers.length > 0 &&
                      activeUsers.every((u) => memberIds.includes(u.id))
                    }
                    onChange={() => {
                      const allIds = activeUsers.map((u) => u.id);
                      const allOn =
                        allIds.length > 0 && allIds.every((id) => memberIds.includes(id));
                      setMemberIds(allOn ? [] : allIds);
                    }}
                  />
                  <span>Todos</span>
                </label>
                <div className="collab-multi-grid">
                  {activeUsers.map((u) => (
                    <label key={u.id} className="collab-multi-option">
                      <input
                        type="checkbox"
                        checked={memberIds.includes(u.id)}
                        onChange={() => {
                          setMemberIds((prev) =>
                            prev.includes(u.id)
                              ? prev.filter((id) => id !== u.id)
                              : [...prev, u.id],
                          );
                        }}
                      />
                      <span>{u.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            </fieldset>
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
                  Vincula tu Gmail ({user?.name ?? 'tú'}) solo para eventos que estén en Google.
                  {isOrlandoViewer
                    ? ' Lo de Hotmail/Outlook no sale aquí: usa la sección Outlook abajo.'
                    : ' Tu agenda personal es privada; sí verás si Orlando está ocupado.'}{' '}
                  Se sincroniza sola.
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
                    <p className="calendar-ics-status">
                      {googleSyncing
                        ? 'Sincronizando con Gmail…'
                        : 'Sincronización automática activa — no necesitas hacer clic.'}
                    </p>
                    {googleStatus.lastError && (
                      <p className="calendar-ics-status">{googleStatus.lastError}</p>
                    )}
                    <button
                      type="button"
                      className="btn-ghost"
                      disabled={googleSyncing}
                      onClick={() => void syncGoogleNow()}
                    >
                      {googleSyncing ? 'Actualizando…' : 'Actualizar ahora'}
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
              <h3>Agenda de Orlando (Outlook / Hotmail)</h3>
              <p>
                Los pendientes reales de Orlando están en <strong>Outlook/Hotmail</strong>, no en
                Gmail. Por eso en Google Calendar casi no se ven. Publica el calendario en Outlook y
                pega aquí el enlace <code>.ics</code> para traer agosto y el resto al dashboard
                (el equipo verá si está ocupado).
              </p>
              <ol className="calendar-orlando-week-hint" style={{ paddingLeft: '1.2rem' }}>
                <li>Outlook en la web → Calendario → Configuración → Calendarios compartidos</li>
                <li>Publicar calendario → copiar el enlace ICS</li>
                <li>Pegarlo abajo y guardar</li>
              </ol>
              {outlookStatus?.configured ? (
                <>
                  <p className="calendar-ics-status">
                    Conectado{outlookStatus.urlHost ? ` · ${outlookStatus.urlHost}` : ''}
                    {outlookStatus.lastSyncAt
                      ? ` · Última sync ${new Date(outlookStatus.lastSyncAt).toLocaleString('es-MX')}`
                      : ''}
                    {outlookStatus.eventCount != null
                      ? ` · ${outlookStatus.eventCount} eventos`
                      : ''}
                  </p>
                  {outlookStatus.lastError && (
                    <p className="calendar-ics-status">{outlookStatus.lastError}</p>
                  )}
                  <button
                    type="button"
                    className="btn-ghost"
                    disabled={outlookBusy}
                    onClick={() => void syncOutlookNow()}
                  >
                    {outlookBusy ? 'Actualizando Outlook…' : 'Actualizar Outlook ahora'}
                  </button>
                </>
              ) : (
                <>
                  <label>
                    Enlace ICS de Outlook
                    <input
                      value={outlookUrl}
                      onChange={(e) => setOutlookUrl(e.target.value)}
                      placeholder="https://outlook.live.com/owa/calendar/..../calendar.ics"
                      autoComplete="off"
                    />
                  </label>
                  <button
                    type="button"
                    className="btn-primary"
                    disabled={outlookBusy || !outlookUrl.trim()}
                    onClick={() => void saveOutlookLink()}
                  >
                    {outlookBusy ? 'Guardando…' : 'Guardar y sincronizar Outlook'}
                  </button>
                </>
              )}
              {outlookMessage && <p className="calendar-ics-status">{outlookMessage}</p>}
              <p className="calendar-ics-status">
                También puedes subir un archivo <code>.olm</code> / <code>.ics</code> exportado:
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

          {!isOrlandoViewer && (
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
          )}

          <div className="calendar-events">
            <h3>Pendientes del día ({dayEvents.length})</h3>
            <p className="calendar-orlando-week-hint">
              Solo el día seleccionado. Marca como hecho cuando lo termines.
            </p>
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
        </section>
      </div>

      {dayModalOpen && (
        <div
          className="calendar-day-modal-backdrop"
          role="presentation"
          onClick={() => setDayModalOpen(false)}
        >
          <div
            className="calendar-day-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="calendar-day-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="calendar-day-modal-head">
              <div>
                <p className="calendar-day-modal-eyebrow">Agenda del día</p>
                <h3 id="calendar-day-modal-title">{modalDayLabel}</h3>
              </div>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setDayModalOpen(false)}
              >
                Cerrar
              </button>
            </header>

            <p className="calendar-day-modal-summary">
              {dayEvents.length} pendiente{dayEvents.length === 1 ? '' : 's'}
              {!isOrlandoViewer && orlandoDayEvents.length > 0
                ? ` · Orlando: ${orlandoDayEvents.length} evento${orlandoDayEvents.length === 1 ? '' : 's'}`
                : ''}
            </p>

            {dayEvents.length === 0 ? (
              <p className="calendar-empty">No hay pendientes este día.</p>
            ) : (
              <ul className="calendar-day-modal-list">
                {dayEvents.map((ev) => {
                  const end =
                    ev.estimatedMinutes > 0
                      ? endTimeFromStart(ev.time, ev.estimatedMinutes)
                      : null;
                  return (
                    <li key={ev.id} className={ev.kind === 'busy' ? 'is-busy' : ''}>
                      <div className="calendar-day-modal-when">
                        <strong>
                          {ev.time}
                          {end ? ` – ${end}` : ''}
                        </strong>
                        {ev.kind === 'busy' && (
                          <span className="event-busy-badge">Ocupado</span>
                        )}
                      </div>
                      <p className="calendar-day-modal-title">{ev.title}</p>
                      {ev.memberNames && ev.memberNames.length > 0 && (
                        <p className="calendar-day-modal-members">
                          Integrantes: {ev.memberNames.join(', ')}
                        </p>
                      )}
                      {ev.notes?.trim() && (
                        <p className="calendar-day-modal-notes">{ev.notes.trim()}</p>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}

            {!isOrlandoViewer && orlandoDayEvents.length > 0 && (
              <div className="calendar-day-modal-orlando">
                <h4>Orlando ocupado</h4>
                <ul className="calendar-day-modal-list">
                  {orlandoDayEvents.map((ev) => {
                    const end =
                      ev.estimatedMinutes > 0
                        ? endTimeFromStart(ev.time, ev.estimatedMinutes)
                        : null;
                    return (
                      <li key={`o-${ev.id}`} className="is-busy">
                        <div className="calendar-day-modal-when">
                          <strong>
                            {ev.time}
                            {end ? ` – ${end}` : ''}
                          </strong>
                        </div>
                        <p className="calendar-day-modal-title">{ev.title}</p>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            <div className="calendar-day-modal-actions">
              <button
                type="button"
                className="btn-primary"
                onClick={() => setDayModalOpen(false)}
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}

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

      {event.memberNames && event.memberNames.length > 0 && (
        <p className="event-members">
          Integrantes: {event.memberNames.join(', ')}
        </p>
      )}

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
