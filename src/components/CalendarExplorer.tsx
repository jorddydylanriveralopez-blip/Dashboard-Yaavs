import { useEffect, useMemo, useState, type FormEvent } from 'react';
import type { CalendarEvent, User } from '../types';
import {
  getMonthMatrix,
  monthLabel,
  startOfWeekMonday,
  toDateKey,
} from '../utils/calendarDates';
import { SpellCheckInput } from './SpellCheckField';
import './CalendarExplorer.css';

type ExplorerView = 'day' | 'week' | 'month' | 'year';

const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

function minutesBetweenTimes(start: string, end: string): number {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  if ([sh, sm, eh, em].some((n) => Number.isNaN(n))) return 60;
  let mins = eh * 60 + em - (sh * 60 + sm);
  if (mins <= 0) mins = 30;
  return mins;
}

function endTimeFromStart(start: string, estimatedMinutes: number): string {
  const [sh, sm] = start.split(':').map(Number);
  const total = (sh * 60 + sm + Math.max(0, estimatedMinutes || 60)) % (24 * 60);
  const eh = Math.floor(total / 60);
  const em = total % 60;
  return `${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}`;
}

function parseTimeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

function formatHourLabel(hour: number): string {
  if (hour === 0) return '12 a.m.';
  if (hour < 12) return `${hour} a.m.`;
  if (hour === 12) return '12 p.m.';
  return `${hour - 12} p.m.`;
}

function addDays(dateKey: string, days: number): string {
  const d = new Date(`${dateKey}T12:00:00`);
  d.setDate(d.getDate() + days);
  return toDateKey(d);
}

function shiftMonth(year: number, month: number, delta: number) {
  const d = new Date(year, month + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() };
}

export function CalendarExplorer({
  open,
  onClose,
  initialDate,
  events,
  activeUsers,
  onAddEvent,
}: {
  open: boolean;
  onClose: () => void;
  initialDate: string;
  events: CalendarEvent[];
  activeUsers: User[];
  onAddEvent: (input: {
    title: string;
    date: string;
    time: string;
    estimatedMinutes: number;
    memberIds: string[];
    memberNames: string[];
  }) => void;
}) {
  const [view, setView] = useState<ExplorerView>('day');
  const [cursor, setCursor] = useState(initialDate);
  const [title, setTitle] = useState('');
  const [time, setTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [memberIds, setMemberIds] = useState<string[]>([]);

  useEffect(() => {
    if (open) setCursor(initialDate);
  }, [open, initialDate]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const cursorDate = useMemo(() => new Date(`${cursor}T12:00:00`), [cursor]);
  const year = cursorDate.getFullYear();
  const month = cursorDate.getMonth();

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const ev of events.filter((e) => !e.done)) {
      const list = map.get(ev.date) ?? [];
      list.push(ev);
      map.set(ev.date, list);
    }
    for (const [, list] of map) {
      list.sort((a, b) => a.time.localeCompare(b.time));
    }
    return map;
  }, [events]);

  const dayEvents = eventsByDate.get(cursor) ?? [];

  const weekDays = useMemo(() => {
    const start = startOfWeekMonday(cursorDate);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return toDateKey(d);
    });
  }, [cursorDate]);

  const headerTitle = useMemo(() => {
    if (view === 'year') return String(year);
    if (view === 'month') return monthLabel(year, month);
    if (view === 'week') {
      const a = new Date(`${weekDays[0]}T12:00:00`);
      const b = new Date(`${weekDays[6]}T12:00:00`);
      return `${a.getDate()}–${b.getDate()} ${b.toLocaleDateString('es-MX', {
        month: 'long',
        year: 'numeric',
      })}`;
    }
    return cursorDate.toLocaleDateString('es-MX', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }, [view, year, month, weekDays, cursorDate]);

  const headerSub =
    view === 'day'
      ? cursorDate.toLocaleDateString('es-MX', { weekday: 'long' })
      : view === 'week'
        ? 'Semana'
        : view === 'month'
          ? 'Mes'
          : 'Año';

  const goToday = () => setCursor(toDateKey(new Date()));

  const goPrev = () => {
    if (view === 'day') setCursor(addDays(cursor, -1));
    else if (view === 'week') setCursor(addDays(cursor, -7));
    else if (view === 'month') {
      const next = shiftMonth(year, month, -1);
      setCursor(toDateKey(new Date(next.year, next.month, 1)));
    } else setCursor(toDateKey(new Date(year - 1, month, 1)));
  };

  const goNext = () => {
    if (view === 'day') setCursor(addDays(cursor, 1));
    else if (view === 'week') setCursor(addDays(cursor, 7));
    else if (view === 'month') {
      const next = shiftMonth(year, month, 1);
      setCursor(toDateKey(new Date(next.year, next.month, 1)));
    } else setCursor(toDateKey(new Date(year + 1, month, 1)));
  };

  const handleAdd = (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    const selected = activeUsers.filter((u) => memberIds.includes(u.id));
    onAddEvent({
      title: title.trim(),
      date: cursor,
      time,
      estimatedMinutes: minutesBetweenTimes(time, endTime),
      memberIds: selected.map((u) => u.id),
      memberNames: selected.map((u) => u.name),
    });
    setTitle('');
    setMemberIds([]);
  };

  if (!open) return null;

  return (
    <div className="cal-explorer-backdrop" role="presentation" onClick={onClose}>
      <div
        className="cal-explorer"
        role="dialog"
        aria-modal="true"
        aria-label="Calendario completo"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="cal-explorer-top">
          <div className="cal-explorer-title-block">
            <h2>{headerTitle}</h2>
            <p>{headerSub}</p>
          </div>

          <div className="cal-explorer-tabs" role="tablist" aria-label="Vista">
            {(
              [
                ['day', 'Día'],
                ['week', 'Semana'],
                ['month', 'Mes'],
                ['year', 'Año'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={view === id}
                className={view === id ? 'is-active' : ''}
                onClick={() => setView(id)}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="cal-explorer-nav">
            <button type="button" className="btn-ghost" onClick={goPrev}>
              ‹
            </button>
            <button type="button" className="btn-ghost" onClick={goToday}>
              Hoy
            </button>
            <button type="button" className="btn-ghost" onClick={goNext}>
              ›
            </button>
            <button type="button" className="btn-ghost" onClick={onClose}>
              Cerrar
            </button>
          </div>
        </header>

        <div className="cal-explorer-body">
          <div className="cal-explorer-main">
            {view === 'day' && (
              <DayTimeline
                dateKey={cursor}
                events={dayEvents}
                onPickHour={(hour) => {
                  const start = `${String(hour).padStart(2, '0')}:00`;
                  setTime(start);
                  setEndTime(endTimeFromStart(start, 60));
                }}
              />
            )}

            {view === 'week' && (
              <WeekTimeline
                days={weekDays}
                eventsByDate={eventsByDate}
                selected={cursor}
                onSelectDay={(d) => {
                  setCursor(d);
                  setView('day');
                }}
              />
            )}

            {view === 'month' && (
              <MonthBoard
                year={year}
                month={month}
                eventsByDate={eventsByDate}
                selected={cursor}
                onSelectDay={(d) => {
                  setCursor(d);
                  setView('day');
                }}
              />
            )}

            {view === 'year' && (
              <YearBoard
                year={year}
                eventsByDate={eventsByDate}
                selected={cursor}
                onSelectMonth={(y, m) => {
                  setCursor(toDateKey(new Date(y, m, 1)));
                  setView('month');
                }}
              />
            )}
          </div>

          <aside className="cal-explorer-side">
            <MiniMonth
              year={year}
              month={month}
              selected={cursor}
              eventsByDate={eventsByDate}
              onSelectDay={(d) => {
                setCursor(d);
                setView('day');
              }}
              onShift={(delta) => {
                const next = shiftMonth(year, month, delta);
                setCursor(toDateKey(new Date(next.year, next.month, Math.min(cursorDate.getDate(), 28))));
              }}
            />

            <section className="cal-explorer-day-list">
              <h3>
                {cursorDate.toLocaleDateString('es-MX', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'short',
                })}
              </h3>
              {dayEvents.length === 0 ? (
                <p className="cal-explorer-empty">Ningún evento este día.</p>
              ) : (
                <ul>
                  {dayEvents.map((ev) => (
                    <li key={ev.id}>
                      <strong>
                        {ev.time}
                        {ev.estimatedMinutes > 0
                          ? `–${endTimeFromStart(ev.time, ev.estimatedMinutes)}`
                          : ''}
                      </strong>
                      <span>{ev.title}</span>
                      {ev.memberNames && ev.memberNames.length > 0 && (
                        <em>{ev.memberNames.join(', ')}</em>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <form className="cal-explorer-form" onSubmit={handleAdd}>
              <h3>Nuevo pendiente</h3>
              <label>
                Título
                <SpellCheckInput
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Qué hay que hacer…"
                  required
                />
              </label>
              <label>
                Fecha
                <input
                  type="date"
                  value={cursor}
                  onChange={(e) => setCursor(e.target.value)}
                  required
                />
              </label>
              <div className="cal-explorer-form-row">
                <label>
                  Inicio
                  <input
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    required
                  />
                </label>
                <label>
                  Fin
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    required
                  />
                </label>
              </div>
              <fieldset className="cal-explorer-members">
                <legend>Integrantes</legend>
                <div className="cal-explorer-members-grid">
                  {activeUsers.map((u) => (
                    <label key={u.id}>
                      <input
                        type="checkbox"
                        checked={memberIds.includes(u.id)}
                        onChange={() =>
                          setMemberIds((prev) =>
                            prev.includes(u.id)
                              ? prev.filter((id) => id !== u.id)
                              : [...prev, u.id],
                          )
                        }
                      />
                      <span>{u.name.split(' ')[0]}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <button type="submit" className="btn-primary">
                Agregar pendiente
              </button>
            </form>
          </aside>
        </div>
      </div>
    </div>
  );
}

function DayTimeline({
  dateKey,
  events,
  onPickHour,
}: {
  dateKey: string;
  events: CalendarEvent[];
  onPickHour: (hour: number) => void;
}) {
  void dateKey;
  return (
    <div className="cal-day-timeline">
      {HOURS.map((hour) => (
        <button
          key={hour}
          type="button"
          className="cal-day-row"
          onClick={() => onPickHour(hour)}
        >
          <span className="cal-day-hour">{formatHourLabel(hour)}</span>
          <span className="cal-day-slot">
            {events
              .filter((ev) => {
                const start = parseTimeToMinutes(ev.time);
                const end = start + Math.max(30, ev.estimatedMinutes || 60);
                const slotStart = hour * 60;
                const slotEnd = slotStart + 60;
                return start < slotEnd && end > slotStart;
              })
              .map((ev) => (
                <span key={ev.id} className="cal-day-event">
                  <strong>{ev.time}</strong> {ev.title}
                </span>
              ))}
          </span>
        </button>
      ))}
    </div>
  );
}

function WeekTimeline({
  days,
  eventsByDate,
  selected,
  onSelectDay,
}: {
  days: string[];
  eventsByDate: Map<string, CalendarEvent[]>;
  selected: string;
  onSelectDay: (dateKey: string) => void;
}) {
  return (
    <div className="cal-week">
      <div className="cal-week-head">
        <span />
        {days.map((d) => {
          const dt = new Date(`${d}T12:00:00`);
          return (
            <button
              key={d}
              type="button"
              className={d === selected ? 'is-selected' : ''}
              onClick={() => onSelectDay(d)}
            >
              <em>{WEEKDAYS[dt.getDay() === 0 ? 6 : dt.getDay() - 1]}</em>
              <strong>{dt.getDate()}</strong>
            </button>
          );
        })}
      </div>
      <div className="cal-week-grid">
        {HOURS.filter((h) => h >= 7 && h <= 21).map((hour) => (
          <div key={hour} className="cal-week-row">
            <span className="cal-day-hour">{formatHourLabel(hour)}</span>
            {days.map((d) => {
              const list = (eventsByDate.get(d) ?? []).filter((ev) => {
                const start = parseTimeToMinutes(ev.time);
                return start >= hour * 60 && start < hour * 60 + 60;
              });
              return (
                <button
                  key={`${d}-${hour}`}
                  type="button"
                  className="cal-week-cell"
                  onClick={() => onSelectDay(d)}
                >
                  {list.map((ev) => (
                    <span key={ev.id} className="cal-day-event">
                      {ev.time} {ev.title}
                    </span>
                  ))}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function MonthBoard({
  year,
  month,
  eventsByDate,
  selected,
  onSelectDay,
}: {
  year: number;
  month: number;
  eventsByDate: Map<string, CalendarEvent[]>;
  selected: string;
  onSelectDay: (dateKey: string) => void;
}) {
  const matrix = getMonthMatrix(year, month);
  const today = toDateKey(new Date());
  return (
    <div className="cal-month-board">
      <div className="cal-month-weekdays">
        {WEEKDAYS.map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <div className="cal-month-grid">
        {matrix.flat().map((cell, i) => {
          if (!cell) return <span key={`e-${i}`} className="cal-month-cell empty" />;
          const key = toDateKey(cell);
          const list = eventsByDate.get(key) ?? [];
          return (
            <button
              key={key}
              type="button"
              className={`cal-month-cell ${key === selected ? 'is-selected' : ''} ${key === today ? 'is-today' : ''}`}
              onClick={() => onSelectDay(key)}
            >
              <span className="cal-month-num">{cell.getDate()}</span>
              <span className="cal-month-events">
                {list.slice(0, 3).map((ev) => (
                  <span key={ev.id}>
                    {ev.time} {ev.title}
                  </span>
                ))}
                {list.length > 3 && <em>+{list.length - 3} más</em>}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function YearBoard({
  year,
  eventsByDate,
  selected,
  onSelectMonth,
}: {
  year: number;
  eventsByDate: Map<string, CalendarEvent[]>;
  selected: string;
  onSelectMonth: (year: number, month: number) => void;
}) {
  const selectedMonth = Number(selected.slice(5, 7)) - 1;
  return (
    <div className="cal-year-board">
      {Array.from({ length: 12 }, (_, month) => {
        const matrix = getMonthMatrix(year, month);
        const label = new Date(year, month, 1).toLocaleDateString('es-MX', {
          month: 'long',
        });
        return (
          <button
            key={month}
            type="button"
            className={`cal-year-month ${month === selectedMonth ? 'is-selected' : ''}`}
            onClick={() => onSelectMonth(year, month)}
          >
            <h4>{label}</h4>
            <div className="cal-year-mini">
              {matrix.flat().map((cell, i) => {
                if (!cell) return <span key={`e-${i}`} />;
                const key = toDateKey(cell);
                const has = (eventsByDate.get(key)?.length ?? 0) > 0;
                return (
                  <span key={key} className={has ? 'has-event' : ''}>
                    {cell.getDate()}
                  </span>
                );
              })}
            </div>
          </button>
        );
      })}
    </div>
  );
}

function MiniMonth({
  year,
  month,
  selected,
  eventsByDate,
  onSelectDay,
  onShift,
}: {
  year: number;
  month: number;
  selected: string;
  eventsByDate: Map<string, CalendarEvent[]>;
  onSelectDay: (dateKey: string) => void;
  onShift: (delta: number) => void;
}) {
  const matrix = getMonthMatrix(year, month);
  const today = toDateKey(new Date());
  return (
    <div className="cal-mini">
      <div className="cal-mini-head">
        <button type="button" className="btn-ghost" onClick={() => onShift(-1)}>
          ‹
        </button>
        <strong>{monthLabel(year, month)}</strong>
        <button type="button" className="btn-ghost" onClick={() => onShift(1)}>
          ›
        </button>
      </div>
      <div className="cal-mini-weekdays">
        {WEEKDAYS.map((d) => (
          <span key={d}>{d[0]}</span>
        ))}
      </div>
      <div className="cal-mini-grid">
        {matrix.flat().map((cell, i) => {
          if (!cell) return <span key={`e-${i}`} />;
          const key = toDateKey(cell);
          const has = (eventsByDate.get(key)?.length ?? 0) > 0;
          return (
            <button
              key={key}
              type="button"
              className={`${key === selected ? 'is-selected' : ''} ${key === today ? 'is-today' : ''} ${has ? 'has-event' : ''}`}
              onClick={() => onSelectDay(key)}
            >
              {cell.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}
