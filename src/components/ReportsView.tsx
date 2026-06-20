import { useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { ASSIGNMENT_STATUS_LABELS, STATUS_COLORS, STATUS_LABELS } from '../constants';
import { isActiveProject } from '../utils/activeItems';
import { countOverdueProjects } from '../utils/projectLink';
import { buildWeeklyCompletionTrend } from '../utils/weeklyTrend';
import { exportTeamCsv } from '../utils/exportReport';
import './ReportsView.css';

export function ReportsView() {
  const { board, assignments, projects, completedProjects, canEditAll } = useApp();

  const summary = useMemo(() => {
    const tasks = board.tasks;
    const byStatus = Object.keys(STATUS_LABELS).map((s) => ({
      status: s,
      label: STATUS_LABELS[s as keyof typeof STATUS_LABELS],
      color: STATUS_COLORS[s as keyof typeof STATUS_COLORS],
      count: tasks.filter((t) => t.status === s).length,
    }));
    const maxStatus = Math.max(1, ...byStatus.map((b) => b.count));
    const pendingAsg = assignments.filter((a) => a.status === 'pending').length;
    const acceptedAsg = assignments.filter((a) => a.status === 'accepted').length;
    const avgKpi =
      tasks.length === 0
        ? 0
        : Math.round(
            tasks.reduce((s, t) => s + (t.kpiCurrent / t.kpiTarget) * 100, 0) /
              tasks.length,
          );
    const active = projects.filter(isActiveProject);
    return {
      byStatus,
      maxStatus,
      pendingAsg,
      acceptedAsg,
      avgKpi,
      total: tasks.length,
      activeProjects: active.length,
      overdueProjects: countOverdueProjects(active),
    };
  }, [board.tasks, assignments, projects]);

  const weeklyTrend = useMemo(
    () => buildWeeklyCompletionTrend(completedProjects),
    [completedProjects],
  );

  const maxWeek = Math.max(1, ...weeklyTrend.map((w) => w.count));

  if (!canEditAll) {
    return (
      <p className="reports-empty">Solo el gerente puede ver reportes del equipo.</p>
    );
  }

  return (
    <div className="reports-view">
      <p className="reports-intro">
        Vista ejecutiva del equipo. Métricas clave arriba, tendencia y detalle abajo.
      </p>

      <section className="reports-cards" aria-label="Indicadores principales">
        <div className="report-stat report-stat--highlight">
          <strong>{summary.overdueProjects}</strong>
          <span>Proyectos atrasados</span>
        </div>
        <div className="report-stat">
          <strong>{summary.activeProjects}</strong>
          <span>Proyectos activos</span>
        </div>
        <div className="report-stat">
          <strong>{summary.avgKpi}%</strong>
          <span>KPI promedio</span>
        </div>
        <div className="report-stat">
          <strong>{summary.pendingAsg}</strong>
          <span>Indic. pendientes</span>
        </div>
        <div className="report-stat">
          <strong>{summary.acceptedAsg}</strong>
          <span>Indic. aceptadas</span>
        </div>
        <div className="report-stat">
          <strong>{summary.total}</strong>
          <span>En el equipo</span>
        </div>
      </section>

      <section className="reports-section">
        <h2>Entregas por semana</h2>
        <p className="reports-section-sub">
          Proyectos concluidos (con foto) en las últimas 8 semanas.
        </p>
        <div className="reports-week-chart" role="img" aria-label="Gráfica de entregas semanales">
          {weeklyTrend.map((w) => (
            <div key={w.key} className="reports-week-col">
              <div className="reports-week-bar-wrap">
                <div
                  className="reports-week-bar"
                  style={{ height: `${(w.count / maxWeek) * 100}%` }}
                  title={`${w.count} entregas`}
                />
              </div>
              <span className="reports-week-count">{w.count}</span>
              <span className="reports-week-label">{w.label}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="reports-section">
        <h2>Estado del equipo</h2>
        <p className="reports-section-sub">Distribución de tarjetas en Equipo por estado.</p>
        <ul className="reports-bars">
          {summary.byStatus.map(({ status, label, color, count }) => (
            <li key={status} className="reports-bar-row">
              <span className="reports-bar-label">{label}</span>
              <div className="reports-bar-track">
                <div
                  className="reports-bar-fill"
                  style={{
                    width: `${(count / summary.maxStatus) * 100}%`,
                    background: color,
                  }}
                />
              </div>
              <strong className="reports-bar-count">{count}</strong>
            </li>
          ))}
        </ul>
      </section>

      <section className="reports-section">
        <h2>Últimas indicaciones</h2>
        <ul className="reports-asg-list">
          {assignments.length === 0 ? (
            <li className="reports-asg-empty">Sin indicaciones registradas.</li>
          ) : (
            assignments.slice(0, 8).map((a) => (
              <li key={a.id}>
                <strong>{a.employeeName}</strong> — {a.title}
                <span className={`reports-asg-status status-${a.status}`}>
                  {ASSIGNMENT_STATUS_LABELS[a.status]}
                </span>
              </li>
            ))
          )}
        </ul>
      </section>

      <button
        type="button"
        className="btn-primary"
        onClick={() => exportTeamCsv(board, assignments)}
      >
        Exportar CSV
      </button>
    </div>
  );
}
