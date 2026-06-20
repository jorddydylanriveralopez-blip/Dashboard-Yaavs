import { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { getMonthKey, formatMonthLabel } from '../utils/performanceHistory';
import { getSnapshotForMonth } from '../utils/monthlyArchive';
import {
  buildDailyPulseSeries,
  buildMonthPulseSummary,
  buildTeamPieSlices,
  todayKey,
} from '../utils/dailyKpiSnapshots';
import { PieChart } from './PieChart';
import { DailyPulseChart } from './DailyPulseChart';
import './MarketingPulseView.css';

interface Props {
  /** Si se define, solo muestra esa persona (vista colaborador). */
  employeeId?: string;
}

export function MarketingPulseView({ employeeId }: Props) {
  const {
    marketingTasks,
    dailyKpiStore,
    monthlyArchives,
    canEditAll,
    canSendKpiObjectives,
  } = useApp();

  const currentMonth = getMonthKey();
  const [monthKey, setMonthKey] = useState(currentMonth);
  const isCurrentMonth = monthKey === currentMonth;

  const tasks = useMemo(() => {
    if (employeeId) {
      return marketingTasks.filter((t) => t.employeeId === employeeId);
    }
    return marketingTasks;
  }, [marketingTasks, employeeId]);

  const pieSlices = useMemo(() => buildTeamPieSlices(tasks), [tasks]);

  const monthSummary = useMemo(
    () => buildMonthPulseSummary(dailyKpiStore, tasks, monthKey),
    [dailyKpiStore, tasks, monthKey],
  );

  const archived = getSnapshotForMonth(monthlyArchives, monthKey);

  const monthOptions = useMemo(() => {
    const keys = new Set<string>([currentMonth]);
    for (const s of dailyKpiStore.snapshots) keys.add(s.monthKey);
    for (const s of monthlyArchives.snapshots) keys.add(s.monthKey);
    return [...keys].sort((a, b) => b.localeCompare(a));
  }, [dailyKpiStore, monthlyArchives, currentMonth]);

  const showTeamView = !employeeId && (canEditAll || canSendKpiObjectives);

  if (!showTeamView && !employeeId) {
    return (
      <p className="pulse-empty">
        Tu ritmo diario está en la sección KPIs de tu panel.
      </p>
    );
  }

  return (
    <div className="marketing-pulse">
      <header className="pulse-hero">
        <div>
          <h1 className="pulse-title">
            {employeeId ? 'Mi ritmo del mes' : 'Panorama Marketing'}
          </h1>
          <p className="pulse-sub">
            {isCurrentMonth
              ? 'Avance día a día del equipo. ↑ subió el KPI, ↓ bajó o no entregó, → sin cambio.'
              : 'Resumen histórico del mes seleccionado.'}
          </p>
        </div>
        <label className="pulse-month-picker">
          Mes
          <select value={monthKey} onChange={(e) => setMonthKey(e.target.value)}>
            {monthOptions.map((m) => (
              <option key={m} value={m}>
                {formatMonthLabel(m)}
                {m === currentMonth ? ' (actual)' : ''}
              </option>
            ))}
          </select>
        </label>
      </header>

      <section className="pulse-kpis" aria-label="Resumen">
        <div className="pulse-stat">
          <strong>{monthSummary.teamAvg}%</strong>
          <span>KPI promedio</span>
        </div>
        <div className="pulse-stat">
          <strong>{monthSummary.daysTracked}</strong>
          <span>Días registrados</span>
        </div>
        <div className="pulse-stat pulse-stat--up">
          <strong>{monthSummary.daysProgressed}</strong>
          <span>Días con avance</span>
        </div>
        {monthSummary.bestDay && (
          <div className="pulse-stat">
            <strong>{monthSummary.bestDay.avgKpi}%</strong>
            <span>Mejor día ({monthSummary.bestDay.dateKey.slice(8)})</span>
          </div>
        )}
      </section>

      {showTeamView && pieSlices.length > 0 && (
        <section className="pulse-section">
          <h2>Equipo en porcentaje</h2>
          <p className="pulse-section-sub">
            Cada porción refleja el KPI actual de la persona. Se actualiza al registrar avance cada día.
          </p>
          <div className="pulse-pie-wrap">
            <PieChart slices={pieSlices} title="Distribución KPI del equipo" />
          </div>
        </section>
      )}

      <section className="pulse-section">
        <h2>{employeeId ? 'Tu diagrama diario' : 'Ritmo día a día por persona'}</h2>
        <p className="pulse-section-sub">
          Últimos días del mes: si hoy no entregó baja o se queda plano; si mañana sí, sube.
        </p>
        <div className={`pulse-grid ${employeeId ? 'pulse-grid--single' : ''}`}>
          {tasks.map((t) => (
            <DailyPulseChart
              key={t.employeeId}
              employeeName={t.employeeName}
              color={t.avatarColor}
              series={buildDailyPulseSeries(dailyKpiStore, t.employeeId, monthKey)}
              compact={Boolean(employeeId)}
            />
          ))}
        </div>
      </section>

      <section className="pulse-section pulse-month-close">
        <h2>
          {isCurrentMonth ? 'Proyección de cierre de mes' : `Detalle final — ${monthSummary.monthLabel}`}
        </h2>
        <p className="pulse-section-sub">
          {isCurrentMonth
            ? 'Al terminar el mes verás aquí el resumen definitivo y podrás descargarlo en Historial.'
            : 'Comparativo inicio vs fin de mes por colaborador.'}
        </p>

        {monthSummary.members.length === 0 ? (
          <p className="pulse-empty-inline">Sin movimientos registrados en este periodo.</p>
        ) : (
          <div className="pulse-close-table-wrap">
            <table className="pulse-close-table">
              <thead>
                <tr>
                  <th>Colaborador</th>
                  <th>Inicio mes</th>
                  <th>{isCurrentMonth ? 'Hoy' : 'Cierre'}</th>
                  <th>Cambio</th>
                  <th>Días ↑</th>
                  <th>Días →/↓</th>
                </tr>
              </thead>
              <tbody>
                {monthSummary.members.map((m) => (
                  <tr key={m.employeeId}>
                    <td>
                      <span className="pulse-close-dot" style={{ background: m.color }} />
                      {m.employeeName}
                    </td>
                    <td>{m.startKpi}%</td>
                    <td>
                      <strong>{m.endKpi}%</strong>
                    </td>
                    <td>
                      <span className={m.change >= 0 ? 'pulse-change-up' : 'pulse-change-down'}>
                        {m.change >= 0 ? '+' : ''}
                        {m.change}%
                      </span>
                    </td>
                    <td className="pulse-change-up">{m.daysUp}</td>
                    <td>{m.daysDown}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {archived && !isCurrentMonth && (
          <div className="pulse-archived" role="status">
            <strong>Respaldo archivado</strong>
            <span>
              KPI promedio {archived.summary.kpiAverage}% · {archived.summary.projectsCompleted}{' '}
              proyectos concluidos · {archived.summary.assignmentsTotal} indicaciones
            </span>
            <span className="pulse-archived-date">
              Guardado el {archived.archivedAt.slice(0, 10)}
            </span>
          </div>
        )}

        {isCurrentMonth && (
          <p className="pulse-today-note">
            Última actualización: {todayKey()} — los datos se guardan al abrir Yaavs y al actualizar KPIs.
          </p>
        )}
      </section>
    </div>
  );
}
