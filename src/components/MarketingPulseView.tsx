import { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { ASSIGNMENT_STATUS_LABELS, STATUS_COLORS, STATUS_LABELS } from '../constants';
import { isActiveProject } from '../utils/activeItems';
import { countOverdueProjects } from '../utils/projectLink';
import { buildWeeklyCompletionTrend } from '../utils/weeklyTrend';
import { getMonthKey, formatMonthLabel } from '../utils/performanceHistory';
import { getSnapshotForMonth } from '../utils/monthlyArchive';
import {
  buildDailyPulseSeries,
  buildMonthPulseSummary,
  buildTeamPieSlices,
  todayKey,
} from '../utils/dailyKpiSnapshots';
import {
  buildPanoramaSemaphores,
  exportPanorama,
  formatProjectHoursRow,
} from '../utils/exportPanorama';
import { collaboratorLabel } from '../utils/collaboratorSemaphore';
import { getHoursPaceInfo } from '../utils/projectHours';
import { PieChart } from './PieChart';
import { DailyPulseChart } from './DailyPulseChart';
import { PanoramaTeamBreakdown } from './PanoramaTeamBreakdown';
import { PulseSemaphorePanel } from './PulseSemaphorePanel';
import { PanoramaTeamPie } from './PanoramaTeamPie';
import { PanoramaDeliveryLineChart } from './PanoramaDeliveryLineChart';
import { buildPanoramaDeliverySummary } from '../utils/panoramaDelivery';
import { buildPanoramaMemberDetails } from '../utils/panoramaDetail';
import './MarketingPulseView.css';
import './PanoramaTeamBreakdown.css';
import './PulseSemaphorePanel.css';
import './PanoramaTeamPie.css';
import './PanoramaDeliveryLineChart.css';

interface Props {
  employeeId?: string;
}

export function MarketingPulseView({ employeeId }: Props) {
  const {
    marketingTasks,
    dailyKpiStore,
    monthlyArchives,
    allProjects,
    attendanceStore,
    managerObservations,
    assignments,
    completedProjects,
    canEditAll,
    canSendKpiObjectives,
  } = useApp();

  const currentMonth = getMonthKey();
  const [monthKey, setMonthKey] = useState(currentMonth);
  const isCurrentMonth = monthKey === currentMonth;

  const teamTasks = useMemo(
    () => marketingTasks.filter((t) => t.employeeId !== 'emp-orlando'),
    [marketingTasks],
  );

  const tasks = useMemo(() => {
    if (employeeId) {
      return marketingTasks.filter((t) => t.employeeId === employeeId);
    }
    return teamTasks;
  }, [marketingTasks, employeeId, teamTasks]);

  const pieSlices = useMemo(() => buildTeamPieSlices(tasks), [tasks]);

  const monthSummary = useMemo(
    () => buildMonthPulseSummary(dailyKpiStore, tasks, monthKey),
    [dailyKpiStore, tasks, monthKey],
  );

  const deliverySummary = useMemo(
    () => buildPanoramaDeliverySummary(allProjects, monthKey),
    [allProjects, monthKey],
  );

  const semaphores = useMemo(() => buildPanoramaSemaphores(allProjects), [allProjects]);

  const memberDetails = useMemo(
    () =>
      buildPanoramaMemberDetails({
        monthKey,
        tasks: teamTasks,
        dailyKpiStore,
        allProjects,
        attendanceStore,
        semaphores,
      }),
    [monthKey, teamTasks, dailyKpiStore, allProjects, attendanceStore, semaphores],
  );

  const archived = getSnapshotForMonth(monthlyArchives, monthKey);

  const monthOptions = useMemo(() => {
    const keys = new Set<string>([currentMonth]);
    for (const s of dailyKpiStore.snapshots) keys.add(s.monthKey);
    for (const s of monthlyArchives.snapshots) keys.add(s.monthKey);
    return [...keys].sort((a, b) => b.localeCompare(a));
  }, [dailyKpiStore, monthlyArchives, currentMonth]);

  const showTeamView = !employeeId && (canEditAll || canSendKpiObjectives);

  const activeWithHours = useMemo(
    () => allProjects.filter((p) => p.status !== 'terminado' && p.collaborator !== 'todos'),
    [allProjects],
  );

  const opsSummary = useMemo(() => {
    const byStatus = Object.keys(STATUS_LABELS).map((s) => ({
      status: s,
      label: STATUS_LABELS[s as keyof typeof STATUS_LABELS],
      color: STATUS_COLORS[s as keyof typeof STATUS_COLORS],
      count: teamTasks.filter((t) => t.status === s).length,
    }));
    const maxStatus = Math.max(1, ...byStatus.map((b) => b.count));
    const active = allProjects.filter(isActiveProject);
    return {
      byStatus,
      maxStatus,
      pendingAsg: assignments.filter((a) => a.status === 'pending').length,
      activeProjects: active.length,
      overdueProjects: countOverdueProjects(active),
    };
  }, [teamTasks, assignments, allProjects]);

  const weeklyTrend = useMemo(
    () => buildWeeklyCompletionTrend(completedProjects),
    [completedProjects],
  );

  const maxWeek = Math.max(1, ...weeklyTrend.map((w) => w.count));

  if (!showTeamView && !employeeId) {
    return (
      <p className="pulse-empty">
        Tu ritmo diario está en Equipo → KPIs del mes.
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
            {showTeamView
              ? 'Panorama del mes basado en proyectos entregados: ritmo de entrega, KPI del equipo e indicaciones pendientes.'
              : 'Tu ritmo diario y avance del mes en el área creativa.'}
          </p>
        </div>
        <div className="pulse-hero-actions">
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
          {showTeamView && (
            <button
              type="button"
              className="btn-primary"
              onClick={() =>
                exportPanorama({
                  monthKey,
                  tasks: teamTasks,
                  dailyKpiStore,
                  allProjects,
    attendanceStore,
    managerObservations,
    semaphores,
    pendingAssignments: opsSummary.pendingAsg,
  })
              }
            >
              Descargar panorama
            </button>
          )}
        </div>
      </header>

      {showTeamView ? (
        <section className="pulse-kpis yaavs-stagger" aria-label="Resumen de entregas">
          <div className="pulse-stat pulse-stat--up">
            <strong>{deliverySummary.avgDeliveryPercent}%</strong>
            <span>Avance promedio</span>
          </div>
          <div className="pulse-stat">
            <strong>{deliverySummary.daysWithDeliveries}</strong>
            <span>Días registrados</span>
          </div>
          <div className="pulse-ops-stat pulse-ops-stat--alert">
            <strong>{deliverySummary.overdueProjects}</strong>
            <span>Proyectos atrasados</span>
          </div>
          <div className="pulse-ops-stat">
            <strong>{deliverySummary.activeProjects}</strong>
            <span>Proyectos activos</span>
          </div>
          <div className="pulse-ops-stat">
            <strong>{monthSummary.teamAvg}%</strong>
            <span>Avance KPI promedio</span>
          </div>
          <div className="pulse-ops-stat">
            <strong>{opsSummary.pendingAsg}</strong>
            <span>Pendientes</span>
          </div>
        </section>
      ) : (
        <section className="pulse-kpis yaavs-stagger" aria-label="Resumen">
          <div className="pulse-stat">
            <strong>{monthSummary.teamAvg}%</strong>
            <span>Avance promedio</span>
          </div>
          <div className="pulse-stat">
            <strong>{monthSummary.daysTracked}</strong>
            <span>Días registrados</span>
          </div>
        </section>
      )}

      {showTeamView && <PanoramaTeamPie members={memberDetails} />}

      {showTeamView && (
        <PanoramaDeliveryLineChart projects={allProjects} extraMonthKeys={monthOptions} />
      )}

      {showTeamView && (
        <PulseSemaphorePanel semaphores={semaphores} allProjects={allProjects} />
      )}

      {showTeamView && pieSlices.length > 0 && (
        <section className="pulse-section">
          <h2>Entregas del equipo</h2>
          <p className="pulse-section-sub">
            Toca a alguien para ver sus proyectos en vivo, cronómetro, atrasados y pendientes.
          </p>
          <div className="pulse-team-layout">
            <div className="pulse-pie-wrap">
              <PieChart slices={pieSlices} title="Avance del equipo" centerLabel="avance promedio" />
            </div>
            <PanoramaTeamBreakdown
              members={memberDetails}
              monthKey={monthKey}
              allProjects={allProjects}
              assignments={assignments}
            />
          </div>
        </section>
      )}

      {showTeamView && (
        <div className="pulse-ops-grid">
          <section className="pulse-section">
            <h2>Entregas por semana</h2>
            <p className="pulse-section-sub">
              Proyectos concluidos (con foto) en las últimas 8 semanas.
            </p>
            <div className="pulse-week-chart" role="img" aria-label="Gráfica de entregas semanales">
              {weeklyTrend.map((w, i) => (
                <div key={w.key} className="pulse-week-col">
                  <div className="pulse-week-bar-wrap">
                    <div
                      className="pulse-week-bar chart-bar-rise"
                      style={{
                        height: `${(w.count / maxWeek) * 100}%`,
                        ['--bar-i' as string]: i,
                      }}
                      title={`${w.count} entregas`}
                    />
                  </div>
                  <span className="pulse-week-count">{w.count}</span>
                  <span className="pulse-week-label">{w.label}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="pulse-section">
            <h2>Estado del equipo</h2>
            <p className="pulse-section-sub">Distribución de tarjetas en Equipo por estado.</p>
            <ul className="pulse-status-bars">
              {opsSummary.byStatus.map(({ status, label, color, count }, i) => (
                <li key={status} className="pulse-status-row">
                  <span className="pulse-status-label">{label}</span>
                  <div className="pulse-status-track">
                    <div
                      className="pulse-status-fill chart-bar-fill-x"
                      style={{
                        width: `${(count / opsSummary.maxStatus) * 100}%`,
                        background: color,
                        ['--bar-i' as string]: i,
                      }}
                    />
                  </div>
                  <strong className="pulse-status-count">{count}</strong>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}

      {showTeamView && (
        <section className="pulse-section">
          <h2>Últimas indicaciones</h2>
          <p className="pulse-section-sub">Seguimiento rápido de lo enviado al equipo.</p>
          <ul className="pulse-asg-list">
            {assignments.length === 0 ? (
              <li className="pulse-asg-empty">Sin indicaciones registradas.</li>
            ) : (
              assignments.slice(0, 8).map((a) => (
                <li key={a.id}>
                  <strong>{a.employeeName}</strong> — {a.title}
                  <span className={`pulse-asg-status status-${a.status}`}>
                    {ASSIGNMENT_STATUS_LABELS[a.status]}
                  </span>
                </li>
              ))
            )}
          </ul>
        </section>
      )}

      <section className="pulse-section">
        <h2>{employeeId ? 'Tu diagrama diario' : 'Ritmo día a día por persona'}</h2>
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

        {showTeamView && activeWithHours.length > 0 && (
          <div className="pulse-active-hours">
            <h3>Proyectos activos — resumen de horas</h3>
            <ul>
              {activeWithHours.map((p) => {
                const pace = getHoursPaceInfo(p);
                return (
                <li
                  key={p.id}
                  className={
                    pace.level === 'exceeded' || pace.level === 'danger'
                      ? 'over'
                      : pace.level === 'warning'
                        ? 'warn'
                        : ''
                  }
                >
                  <strong>{p.projectName}</strong> ({collaboratorLabel(p.collaborator)}) —{' '}
                  {formatProjectHoursRow(p)} · {pace.label}
                </li>
                );
              })}
            </ul>
          </div>
        )}

        {archived && !isCurrentMonth && (
          <div className="pulse-archived" role="status">
            <strong>Respaldo archivado</strong>
            <span>
              KPI promedio {archived.summary.kpiAverage}% · {archived.summary.projectsCompleted}{' '}
              proyectos concluidos
            </span>
          </div>
        )}

        {isCurrentMonth && (
          <p className="pulse-today-note">
            Última actualización: {todayKey()} — descarga el panorama completo con el botón superior.
          </p>
        )}
      </section>
    </div>
  );
}
