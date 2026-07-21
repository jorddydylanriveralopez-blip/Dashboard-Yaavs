import { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import { AttendanceMemberPie } from './AttendanceMemberPie';
import { formatDayMonthLabel, formatDayShortLabel, formatLongDate } from '../utils/formatDate';
import { getMonthKey, formatMonthLabel } from '../utils/performanceHistory';
import {
  ATTENDANCE_STATUS_LABELS,
  ATTENDANCE_STATUS_SYMBOL,
  attendanceDayTone,
  daysInMonth,
  defaultSelectedDay,
  dominantAttendanceStatus,
  exportAttendanceCsv,
  filterDaysByRange,
  getAttendanceForDay,
  nextAttendanceStatus,
  summarizeAttendance,
  todayDateKey,
} from '../utils/attendance';
import type { AttendanceStatus } from '../types';
import './AttendanceView.css';

const STATUS_ORDER: AttendanceStatus[] = ['present', 'absent', 'sick', 'late', 'vacation'];

const DAY_STAT_LABELS: Record<AttendanceStatus, string> = {
  present: 'asistencias',
  absent: 'faltas',
  sick: 'enfermedad',
  late: 'retardos',
  vacation: 'vacaciones',
};

export function AttendanceView() {
  const { marketingTasks, attendanceStore, canEditAll, user, setAttendanceStatus } = useApp();
  const currentMonth = getMonthKey();
  const [monthKey, setMonthKey] = useState(currentMonth);
  const [selectedDay, setSelectedDay] = useState(() => defaultSelectedDay(currentMonth));
  const [chartEmployee, setChartEmployee] = useState<string>('all');
  const [chartRangeFrom, setChartRangeFrom] = useState('');
  const [chartRangeTo, setChartRangeTo] = useState('');
  const dayStripRef = useRef<HTMLDivElement>(null);

  const team = useMemo(
    () => marketingTasks.filter((t) => t.employeeId !== 'emp-orlando'),
    [marketingTasks],
  );

  const monthDays = useMemo(() => daysInMonth(monthKey), [monthKey]);
  const chartDays = useMemo(() => {
    if (!chartRangeFrom || !chartRangeTo) return monthDays;
    return filterDaysByRange(monthDays, chartRangeFrom, chartRangeTo);
  }, [monthDays, chartRangeFrom, chartRangeTo]);
  const isFullMonthRange =
    chartDays.length === monthDays.length &&
    chartDays[0] === monthDays[0] &&
    chartDays[chartDays.length - 1] === monthDays[monthDays.length - 1];
  const summary = useMemo(
    () => summarizeAttendance(attendanceStore, marketingTasks, monthKey),
    [attendanceStore, marketingTasks, monthKey],
  );

  const monthOptions = useMemo(() => {
    const keys = new Set<string>([currentMonth]);
    for (const r of attendanceStore.records) keys.add(r.monthKey);
    return [...keys].sort((a, b) => b.localeCompare(a));
  }, [attendanceStore, currentMonth]);

  useEffect(() => {
    const days = daysInMonth(monthKey);
    setSelectedDay(defaultSelectedDay(monthKey));
    setChartRangeFrom(days[0] ?? '');
    setChartRangeTo(days[days.length - 1] ?? '');
  }, [monthKey]);

  useEffect(() => {
    const el = dayStripRef.current?.querySelector('.attendance-day-chip--active');
    el?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [selectedDay, monthKey]);

  const handleStatusClick = (employeeId: string, employeeName: string, dateKey: string) => {
    if (!canEditAll || !user) return;
    const existing = getAttendanceForDay(attendanceStore, employeeId, dateKey);
    const next = nextAttendanceStatus(existing?.status);
    setAttendanceStatus({
      employeeId,
      employeeName,
      dateKey,
      monthKey,
      status: next,
    });
  };

  const dayRoster = useMemo(
    () =>
      team.map((t) => {
        const rec = getAttendanceForDay(attendanceStore, t.employeeId, selectedDay);
        return {
          employeeId: t.employeeId,
          employeeName: t.employeeName,
          color: t.avatarColor,
          status: rec?.status,
          tone: attendanceDayTone(rec?.status),
        };
      }),
    [team, attendanceStore, selectedDay],
  );

  const dayTotals = useMemo(() => {
    const t = {
      present: 0,
      absent: 0,
      sick: 0,
      late: 0,
      vacation: 0,
      unset: 0,
    };
    for (const row of dayRoster) {
      if (row.tone === 'unset') t.unset += 1;
      else t[row.tone] += 1;
    }
    return t;
  }, [dayRoster]);

  const chartRows = useMemo(() => {
    const employees =
      chartEmployee === 'all' ? team : team.filter((t) => t.employeeId === chartEmployee);

    return chartDays.map((dateKey) => {
      const counts = {
        present: 0,
        absent: 0,
        sick: 0,
        late: 0,
        vacation: 0,
        unset: 0,
      };

      for (const t of employees) {
        const rec = getAttendanceForDay(attendanceStore, t.employeeId, dateKey);
        const tone = attendanceDayTone(rec?.status);
        if (tone === 'unset') counts.unset += 1;
        else counts[tone] += 1;
      }

      const total = employees.length || 1;
      const dominant = dominantAttendanceStatus(counts);
      const marked = total - counts.unset;
      const topCount = Math.max(
        counts.present,
        counts.absent,
        counts.sick,
        counts.late,
        counts.vacation,
      );
      const barHeight =
        employees.length === 1
          ? dominant === 'unset'
            ? 8
            : 100
          : Math.max(12, Math.round((topCount / total) * 100) || (dominant === 'unset' ? 8 : 12));

      return {
        dateKey,
        counts,
        dominant,
        barHeight,
        isSelected: dateKey === selectedDay,
        marked,
        total,
      };
    });
  }, [chartDays, chartEmployee, team, attendanceStore, selectedDay]);

  const totals = useMemo(() => {
    const t = { present: 0, absent: 0, sick: 0, late: 0, vacation: 0 };
    for (const s of summary) {
      t.present += s.present;
      t.absent += s.absent;
      t.sick += s.sick;
      t.late += s.late;
      t.vacation += s.vacation;
    }
    return t;
  }, [summary]);

  const isToday = selectedDay === todayDateKey();
  const monthLabel = formatMonthLabel(monthKey);

  const resetChartRange = () => {
    setChartRangeFrom(monthDays[0] ?? '');
    setChartRangeTo(monthDays[monthDays.length - 1] ?? '');
  };

  const handleRangeFromChange = (dateKey: string) => {
    setChartRangeFrom(dateKey);
    if (dateKey > chartRangeTo) setChartRangeTo(dateKey);
  };

  const handleRangeToChange = (dateKey: string) => {
    setChartRangeTo(dateKey);
    if (dateKey < chartRangeFrom) setChartRangeFrom(dateKey);
  };

  return (
    <div className="attendance-view">
      <header className="attendance-hero">
        <div>
          <h1 className="attendance-title">Asistencia del área</h1>
          <p className="attendance-sub">
            {canEditAll
              ? 'Elige un día, revisa quién vino y controla el mes con la gráfica de abajo.'
              : 'Consulta día por día quién asistió y quién no del equipo de Marketing.'}
          </p>
        </div>
        <div className="attendance-hero-actions">
          <label className="attendance-month">
            Mes
            <select value={monthKey} onChange={(e) => setMonthKey(e.target.value)}>
              {monthOptions.map((m) => (
                <option key={m} value={m}>
                  {formatMonthLabel(m)}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="btn-primary"
            onClick={() => exportAttendanceCsv(attendanceStore, marketingTasks, monthKey)}
          >
            Descargar reporte
          </button>
        </div>
      </header>

      <section className="attendance-stats yaavs-stagger" aria-label="Resumen del mes">
        <div className="attendance-stat attendance-stat--ok">
          <strong>{totals.present}</strong>
          <span>Asistencias</span>
        </div>
        <div className="attendance-stat attendance-stat--bad">
          <strong>{totals.absent}</strong>
          <span>Faltas</span>
        </div>
        <div className="attendance-stat attendance-stat--sick">
          <strong>{totals.sick}</strong>
          <span>Enfermedad</span>
        </div>
        <div className="attendance-stat attendance-stat--late">
          <strong>{totals.late}</strong>
          <span>Retardos</span>
        </div>
        <div className="attendance-stat attendance-stat--vacation">
          <strong>{totals.vacation}</strong>
          <span>Vacaciones</span>
        </div>
      </section>

      <section className="attendance-day-section" aria-label="Selección de día">
        <div className="attendance-day-section-head">
          <h2>Selecciona el día</h2>
          <p>Toca un día del mes para ver el detalle del equipo.</p>
        </div>
        <div className="attendance-day-strip" ref={dayStripRef}>
          {monthDays.map((dateKey, i) => {
            const active = dateKey === selectedDay;
            const isDayToday = dateKey === todayDateKey();
            return (
              <button
                key={dateKey}
                type="button"
                className={`attendance-day-chip${active ? ' attendance-day-chip--active' : ''}${isDayToday ? ' attendance-day-chip--today' : ''}`}
                onClick={() => setSelectedDay(dateKey)}
                style={{ ['--bar-i' as string]: i }}
              >
                <span className="attendance-day-chip-short">{formatDayShortLabel(dateKey)}</span>
                <span className="attendance-day-chip-long">{formatDayMonthLabel(dateKey)}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="attendance-day-panel" aria-label={`Asistencia del ${formatLongDate(selectedDay)}`}>
        <header className="attendance-day-panel-head">
          <div>
            <h2>
              {formatDayMonthLabel(selectedDay)}
              {isToday && <span className="attendance-today-badge">Hoy</span>}
            </h2>
            <p>{formatLongDate(selectedDay)}</p>
          </div>
          <div className="attendance-day-panel-stats">
            {STATUS_ORDER.map((status) =>
              dayTotals[status] > 0 ? (
                <span key={status} className={`attendance-day-stat attendance-day-stat--${status}`}>
                  {ATTENDANCE_STATUS_SYMBOL[status]} {dayTotals[status]} {DAY_STAT_LABELS[status]}
                </span>
              ) : null,
            )}
            {dayTotals.unset > 0 && (
              <span className="attendance-day-stat attendance-day-stat--unset">
                · {dayTotals.unset} sin marcar
              </span>
            )}
          </div>
        </header>

        <ul className="attendance-day-roster">
          {dayRoster.map((row) => (
            <li key={row.employeeId}>
              <button
                type="button"
                className={`attendance-day-person attendance-day-person--${row.tone}${canEditAll ? ' attendance-day-person--editable' : ''}`}
                onClick={() =>
                  handleStatusClick(row.employeeId, row.employeeName, selectedDay)
                }
                disabled={!canEditAll}
              >
                <span className="attendance-day-avatar" style={{ background: row.color }}>
                  {row.employeeName.charAt(0)}
                </span>
                <span className="attendance-day-person-info">
                  <strong>{row.employeeName}</strong>
                  <span>
                    {row.status
                      ? ATTENDANCE_STATUS_LABELS[row.status]
                      : 'Sin registro'}
                  </span>
                </span>
                <span className="attendance-day-person-icon" aria-hidden>
                  {row.status ? ATTENDANCE_STATUS_SYMBOL[row.status] : '·'}
                </span>
              </button>
            </li>
          ))}
        </ul>

        {canEditAll && (
          <p className="attendance-day-hint">Toca a alguien para cambiar su estado ese día.</p>
        )}
      </section>

      <section className="attendance-chart-section" aria-label="Gráfica de control mensual">
        <div className="attendance-chart-head">
          <div>
            <h2>Control del mes</h2>
            <p>
              {isFullMonthRange
                ? `Todo ${monthLabel}`
                : `Del ${formatDayMonthLabel(chartRangeFrom)} al ${formatDayMonthLabel(chartRangeTo)}`}
              {' · '}
              Verde = asistencia · Rojo = falta · Amarillo = retardo · Morado = enfermedad · Azul =
              vacaciones
            </p>
          </div>
          <div className="attendance-chart-controls">
            <label className="attendance-chart-filter">
              Del día
              <select value={chartRangeFrom} onChange={(e) => handleRangeFromChange(e.target.value)}>
                {monthDays.map((d) => (
                  <option key={d} value={d}>
                    {formatDayMonthLabel(d)}
                  </option>
                ))}
              </select>
            </label>
            <label className="attendance-chart-filter">
              Al día
              <select value={chartRangeTo} onChange={(e) => handleRangeToChange(e.target.value)}>
                {monthDays.map((d) => (
                  <option key={d} value={d}>
                    {formatDayMonthLabel(d)}
                  </option>
                ))}
              </select>
            </label>
            <label className="attendance-chart-filter">
              Ver gráfica de
              <select value={chartEmployee} onChange={(e) => setChartEmployee(e.target.value)}>
                <option value="all">Todo el equipo</option>
                {team.map((t) => (
                  <option key={t.employeeId} value={t.employeeId}>
                    {t.employeeName}
                  </option>
                ))}
              </select>
            </label>
            {!isFullMonthRange && (
              <button type="button" className="btn-ghost attendance-chart-reset" onClick={resetChartRange}>
                Mes completo
              </button>
            )}
          </div>
        </div>

        {chartDays.length === 0 ? (
          <p className="attendance-chart-empty">No hay días en el rango seleccionado.</p>
        ) : (
        <div
          className="attendance-chart"
          role="img"
          aria-label="Gráfica diaria de asistencia"
        >
          {chartRows.map((row, i) => (
            <button
              key={row.dateKey}
              type="button"
              className={`attendance-chart-col${row.isSelected ? ' attendance-chart-col--selected' : ''}`}
              onClick={() => setSelectedDay(row.dateKey)}
              title={
                row.dominant === 'unset'
                  ? `${formatDayMonthLabel(row.dateKey)}: sin registro`
                  : `${formatDayMonthLabel(row.dateKey)}: ${ATTENDANCE_STATUS_LABELS[row.dominant]}`
              }
            >
              <div className="attendance-chart-bar-wrap">
                <div
                  className={`attendance-chart-bar attendance-chart-bar--${row.dominant} chart-bar-rise`}
                  style={{
                    height: `${row.barHeight}%`,
                    ['--bar-i' as string]: i,
                  }}
                />
              </div>
              <span className="attendance-chart-day">{formatDayShortLabel(row.dateKey)}</span>
            </button>
          ))}
        </div>
        )}

        <div className="attendance-legend">
          {STATUS_ORDER.map((s) => (
            <span key={s} className={`attendance-legend-item attendance-legend-item--${s}`}>
              <i className="attendance-legend-swatch" aria-hidden />
              {ATTENDANCE_STATUS_SYMBOL[s]} {ATTENDANCE_STATUS_LABELS[s]}
            </span>
          ))}
          <span className="attendance-legend-item attendance-legend-item--unset">
            <i className="attendance-legend-swatch" aria-hidden />
            Sin registro
          </span>
        </div>
      </section>

      <section className="attendance-pie-section" aria-label="Desempeño por integrante">
        <header className="attendance-pie-head">
          <div>
            <h2>Desempeño por integrante</h2>
            <p>
              Gráfica de pastel del mes — cómo se reparten asistencias, faltas, retardos, enfermedad
              y vacaciones de cada persona en {monthLabel}.
            </p>
          </div>
        </header>
        <div className="attendance-pie-grid">
          {team.map((t) => {
            const memberSummary = summary.find((s) => s.employeeId === t.employeeId);
            if (!memberSummary) return null;
            return (
              <AttendanceMemberPie
                key={t.employeeId}
                name={t.employeeName}
                avatarColor={t.avatarColor}
                summary={memberSummary}
                monthLabel={monthLabel}
              />
            );
          })}
        </div>
      </section>
    </div>
  );
}
