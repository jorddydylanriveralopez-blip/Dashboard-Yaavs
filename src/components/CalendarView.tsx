import { useMemo, useRef, useState, type FormEvent } from 'react';
import { useApp } from '../context/AppContext';
import { REMINDER_OPTIONS } from '../constants';
import { reminderEmailForUser } from '../api/calendar';
import { useEventReminders } from '../hooks/useEventReminders';
import {
  elapsedMinutesSince,
  formatDuration,
  getMonthMatrix,
  monthLabel,
  toDateKey,
} from '../utils/calendarDates';
import { parseIcsFile } from '../utils/icsImport';
import { SpellCheckInput, SpellCheckTextarea } from './SpellCheckField';
import { useSharedNow } from '../hooks/useSharedNow';
import type { CalendarEvent } from '../types';
import './CalendarView.css';

const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

export function CalendarView() {
  const {
    user,
    calendar,
    calendarStore,
    canEditAll,
    activeUsers,
    addCalendarEvent,
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

  const initialNow = new Date();
  const [year, setYear] = useState(initialNow.getFullYear());
  const [month, setMonth] = useState(initialNow.getMonth());
  const [selectedDate, setSelectedDate] = useState(toDateKey(initialNow));

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

  /** Eventos compartidos de otros usuarios (agenda del equipo). */
  const teamEvents = useMemo(() => {
    if (!user) return [] as CalendarEvent[];
    const nameById = new Map(activeUsers.map((u) => [u.id, u.name]));
    const list: CalendarEvent[] = [];
    for (const [uid, state] of Object.entries(calendarStore)) {
      if (uid === user.id) continue;
      for (const ev of state.events) {
        if (ev.done) continue;
        // shared !== false: incluye eventos nuevos (true) y legacy (undefined)
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

  const handleIcsImport = async (file: File | null) => {
    if (!file) return;
    setIcsStatus('Importando…');
    try {
      const imported = await parseIcsFile(file);
      if (imported.length === 0) {
        setIcsStatus('No se encontraron eventos en el archivo.');
        return;
      }
      let count = 0;
      for (const item of imported) {
        addCalendarEvent({
          title: item.title,
          date: item.date,
          time: item.time,
          reminderMinutes: 30,
          estimatedMinutes: 60,
          notes: item.notes ? `${item.notes}\n(Importado desde correo)` : 'Importado desde correo',
          kind: 'event',
          shared: true,
        });
        count += 1;
      }
      setIcsStatus(`Se importaron ${count} evento${count === 1 ? '' : 's'}.`);
    } catch {
      setIcsStatus('No se pudo leer el archivo .ics.');
    } finally {
      if (icsInputRef.current) icsInputRef.current.value = '';
    }
  };

  const requestNotify = () => {
    if (typeof Notification !== 'undefined') {
      Notification.requestPermission();
    }
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
              const teamCount = teamByDate.get(key)?.length ?? 0;
              const isSelected = key === selectedDate;
              const isToday = key === toDateKey(new Date());
              return (
                <button
                  key={key}
                  type="button"
                  className={`calendar-day ${isSelected ? 'selected' : ''} ${isToday ? 'today' : ''}`}
                  onClick={() => setSelectedDate(key)}
                >
                  <span className="day-num">{cell.getDate()}</span>
                  {(ownCount > 0 || teamCount > 0) && (
                    <span className="day-dots-row" aria-hidden>
                      {ownCount > 0 && <span className="day-dot day-dot--own" />}
                      {teamCount > 0 && <span className="day-dot day-dot--team" />}
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
              <span className="day-dot day-dot--team" /> Equipo
            </p>
            <button type="button" className="btn-ghost notify-btn" onClick={requestNotify}>
              Activar notificaciones
            </button>
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
            <h3>Importar desde correo (.ics)</h3>
            <p>
              En Gmail/Outlook exporta el evento o calendario como <code>.ics</code> y
              súbelo aquí para registrarlo en la agenda del equipo.
            </p>
            <input
              ref={icsInputRef}
              type="file"
              accept=".ics,text/calendar"
              className="calendar-ics-input"
              onChange={(e) => void handleIcsImport(e.target.files?.[0] ?? null)}
            />
            {icsStatus && <p className="calendar-ics-status">{icsStatus}</p>}
            {(canEditAll || user?.employeeId === 'emp-orlando') && (
              <p className="calendar-hint">
                Los eventos importados se comparten con el equipo y generan notificación.
              </p>
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
