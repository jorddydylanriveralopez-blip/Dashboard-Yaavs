import { useMemo } from 'react';
import { STATUS_COLORS, STATUS_LABELS } from '../constants';
import {
  KPI_BUCKET_LABELS,
  buildKpiMonthSummary,
  kpiBucket,
  kpiPercent,
  type KpiBucket,
} from '../utils/kpiStats';
import type { EmployeeTask } from '../types';
import './KpiMonthView.css';

interface Props {
  tasks: EmployeeTask[];
}

const BUCKET_ORDER: KpiBucket[] = ['excelente', 'en_camino', 'atencion', 'critico'];

const BUCKET_COLORS: Record<KpiBucket, string> = {
  excelente: '#00c875',
  en_camino: '#579bfc',
  atencion: '#fdab3d',
  critico: '#e2445c',
};

export function KpiMonthView({ tasks }: Props) {
  const summary = useMemo(() => buildKpiMonthSummary(tasks), [tasks]);

  if (tasks.length === 0) {
    return (
      <div className="kpi-empty">
        <p>No hay datos de KPI para mostrar en esta vista.</p>
      </div>
    );
  }

  return (
    <div className="kpi-month">
      <section className="kpi-hero">
        <div className="kpi-hero-card kpi-hero-main">
          <span className="kpi-hero-label">Promedio del equipo</span>
          <strong className="kpi-hero-value">{summary.teamAvg}%</strong>
          <span className="kpi-hero-meta">
            {summary.totalPeople} colaboradores · {summary.monthLabel}
          </span>
          <div className="kpi-hero-bar">
            <div
              className="kpi-hero-fill"
              style={{ width: `${summary.teamAvg}%` }}
            />
          </div>
        </div>

        {BUCKET_ORDER.map((key) => (
          <div key={key} className="kpi-hero-card kpi-hero-stat">
            <span
              className="kpi-dot"
              style={{ background: BUCKET_COLORS[key] }}
            />
            <strong>{summary.buckets[key]}</strong>
            <span>{KPI_BUCKET_LABELS[key]}</span>
          </div>
        ))}
      </section>

      <section className="kpi-section">
        <h2>Por rol en Marketing</h2>
        <div className="kpi-dept-grid">
          {summary.departments.map((dept) => (
            <div key={dept.department} className="kpi-dept-card">
              <div className="kpi-dept-head">
                <h3>{dept.department}</h3>
                <span className="kpi-dept-avg">{dept.avgPct}%</span>
              </div>
              <div className="kpi-bar">
                <div
                  className="kpi-bar-fill"
                  style={{
                    width: `${dept.avgPct}%`,
                    background: deptBarColor(dept.avgPct),
                  }}
                />
              </div>
              <p className="kpi-dept-meta">
                {dept.count} {dept.count === 1 ? 'persona' : 'personas'}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="kpi-section">
        <h2>Detalle por colaborador</h2>
        <div className="kpi-people-grid">
          {summary.sortedByKpi.map((task) => (
            <KpiPersonCard key={task.id} task={task} />
          ))}
        </div>
      </section>
    </div>
  );
}

function KpiPersonCard({ task }: { task: EmployeeTask }) {
  const pct = kpiPercent(task);
  const bucket = kpiBucket(pct);

  return (
    <article className="kpi-person-card">
      <div className="kpi-person-head">
        <div
          className="avatar sm"
          style={{ background: task.avatarColor }}
        >
          {task.employeeName.charAt(0)}
        </div>
        <div className="kpi-person-info">
          <strong>{task.employeeName}</strong>
          <span>{task.roleTitle ?? task.department}</span>
        </div>
        <span className="kpi-person-pct">{pct}%</span>
      </div>
      <div className="kpi-bar">
        <div
          className="kpi-bar-fill"
          style={{ width: `${pct}%`, background: BUCKET_COLORS[bucket] }}
        />
      </div>
      <p className="kpi-person-objective">{task.objective}</p>
      <div className="kpi-person-footer">
        <span
          className="status-pill"
          style={{ background: STATUS_COLORS[task.status] }}
        >
          {STATUS_LABELS[task.status]}
        </span>
        <span className="kpi-person-kpi-raw">
          {task.kpiCurrent} / {task.kpiTarget}
        </span>
      </div>
    </article>
  );
}

function deptBarColor(avg: number): string {
  return BUCKET_COLORS[kpiBucket(avg)];
}
