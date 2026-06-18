import { useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { ASSIGNMENT_STATUS_LABELS, STATUS_LABELS } from '../constants';
import { exportTeamCsv } from '../utils/exportReport';
import './ReportsView.css';

export function ReportsView() {
  const { board, assignments, canEditAll } = useApp();

  const summary = useMemo(() => {
    const tasks = board.tasks;
    const byStatus = Object.keys(STATUS_LABELS).map((s) => ({
      status: s,
      count: tasks.filter((t) => t.status === s).length,
    }));
    const pendingAsg = assignments.filter((a) => a.status === 'pending').length;
    const acceptedAsg = assignments.filter((a) => a.status === 'accepted').length;
    const avgKpi =
      tasks.length === 0
        ? 0
        : Math.round(
            tasks.reduce((s, t) => s + (t.kpiCurrent / t.kpiTarget) * 100, 0) /
              tasks.length,
          );
    return { byStatus, pendingAsg, acceptedAsg, avgKpi, total: tasks.length };
  }, [board.tasks, assignments]);

  if (!canEditAll) {
    return (
      <p className="reports-empty">Solo el gerente puede ver reportes del equipo.</p>
    );
  }

  return (
    <div className="reports-view">
      <section className="reports-cards">
        <div className="report-stat">
          <strong>{summary.total}</strong>
          <span>En el equipo</span>
        </div>
        <div className="report-stat">
          <strong>{summary.avgKpi}%</strong>
          <span>KPI promedio</span>
        </div>
        <div className="report-stat">
          <strong>{summary.pendingAsg}</strong>
          <span>Indicaciones pendientes</span>
        </div>
        <div className="report-stat">
          <strong>{summary.acceptedAsg}</strong>
          <span>Indicaciones aceptadas</span>
        </div>
      </section>

      <section className="reports-section">
        <h2>Por estado</h2>
        <ul className="reports-list">
          {summary.byStatus.map(({ status, count }) => (
            <li key={status}>
              <span>{STATUS_LABELS[status as keyof typeof STATUS_LABELS]}</span>
              <strong>{count}</strong>
            </li>
          ))}
        </ul>
      </section>

      <section className="reports-section">
        <h2>Últimas indicaciones</h2>
        <ul className="reports-asg-list">
          {assignments.slice(0, 8).map((a) => (
            <li key={a.id}>
              <strong>{a.employeeName}</strong> — {a.title}
              <span className={`reports-asg-status status-${a.status}`}>
                {ASSIGNMENT_STATUS_LABELS[a.status]}
              </span>
            </li>
          ))}
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
