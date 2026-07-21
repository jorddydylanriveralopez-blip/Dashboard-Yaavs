import { useMemo, useState } from 'react';
import type { PanoramaMemberDetail } from '../utils/panoramaDetail';
import type { SemaphoreLevel } from '../utils/collaboratorSemaphore';
import './PanoramaTeamPie.css';

const SIZE = 360;
const CENTER = SIZE / 2;
const OUTER_R = 168;
const INNER_R = 92;
const LABEL_R = (OUTER_R + INNER_R) / 2;

const STATUS_INFO: Record<SemaphoreLevel, { label: string; color: string }> = {
  green: { label: 'Va bien', color: '#10b981' },
  yellow: { label: 'Atención', color: '#f59e0b' },
  red: { label: 'Atrasado', color: '#e2445c' },
};

interface PieMember {
  detail: PanoramaMemberDetail;
  overdueCount: number;
  value: number;
  startAngle: number;
  endAngle: number;
}

function polar(angle: number, radius: number): { x: number; y: number } {
  return {
    x: CENTER + radius * Math.cos(angle),
    y: CENTER + radius * Math.sin(angle),
  };
}

function donutPath(start: number, end: number): string {
  const largeArc = end - start > Math.PI ? 1 : 0;
  const o1 = polar(start, OUTER_R);
  const o2 = polar(end, OUTER_R);
  const i1 = polar(end, INNER_R);
  const i2 = polar(start, INNER_R);
  return [
    `M ${o1.x} ${o1.y}`,
    `A ${OUTER_R} ${OUTER_R} 0 ${largeArc} 1 ${o2.x} ${o2.y}`,
    `L ${i1.x} ${i1.y}`,
    `A ${INNER_R} ${INNER_R} 0 ${largeArc} 0 ${i2.x} ${i2.y}`,
    'Z',
  ].join(' ');
}

function firstName(name: string): string {
  return name.split(' ')[0] ?? name;
}

export function PanoramaTeamPie({ members }: { members: PanoramaMemberDetail[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const pieMembers = useMemo<PieMember[]>(() => {
    const base = members.map((detail) => ({
      detail,
      overdueCount: detail.undeliveredProjects.filter((p) => p.overdue).length,
      value: Math.max(1, detail.projectsActive),
    }));
    const total = base.reduce((sum, m) => sum + m.value, 0);
    let cursor = -Math.PI / 2;
    return base.map((m) => {
      const sweep = Math.min((m.value / total) * Math.PI * 2, Math.PI * 2 - 0.0001);
      const slice = { ...m, startAngle: cursor, endAngle: cursor + sweep };
      cursor += sweep;
      return slice;
    });
  }, [members]);

  const teamTotals = useMemo(
    () => ({
      active: members.reduce((sum, m) => sum + m.projectsActive, 0),
      overdue: members.reduce(
        (sum, m) => sum + m.undeliveredProjects.filter((p) => p.overdue).length,
        0,
      ),
      onTime: members.reduce((sum, m) => sum + m.projectsOnTime, 0),
      delivered: members.reduce((sum, m) => sum + m.projectsCompletedMonth, 0),
    }),
    [members],
  );

  if (members.length === 0) return null;

  const selected = pieMembers.find((m) => m.detail.employeeId === selectedId) ?? null;

  const toggleSelect = (employeeId: string) => {
    setSelectedId((prev) => (prev === employeeId ? null : employeeId));
  };

  return (
    <section className="team-pie-section pulse-section" aria-label="Pastel del equipo">
      <h2>¿Cómo vamos todos?</h2>
      <p className="pulse-section-sub">
        Cada rebanada es una persona del equipo (el tamaño refleja sus proyectos activos). Toca a
        alguien en la gráfica o en las tarjetas para ver su detalle con datos reales.
      </p>

      <div className="team-pie-layout">
        <div className="team-pie-chart-wrap">
          <svg
            className="team-pie-chart"
            viewBox={`0 0 ${SIZE} ${SIZE}`}
            role="img"
            aria-label="Gráfica de pastel del equipo"
          >
            {pieMembers.map((m) => {
              const isSelected = m.detail.employeeId === selectedId;
              const isDimmed = selectedId !== null && !isSelected;
              const mid = (m.startAngle + m.endAngle) / 2;
              const offset = isSelected ? 8 : 0;
              const dx = Math.cos(mid) * offset;
              const dy = Math.sin(mid) * offset;
              const label = polar(mid, LABEL_R);
              const sweepDeg = ((m.endAngle - m.startAngle) * 180) / Math.PI;

              return (
                <g
                  key={m.detail.employeeId}
                  className={`team-pie-slice${isSelected ? ' is-selected' : ''}${isDimmed ? ' is-dimmed' : ''}`}
                  transform={`translate(${dx} ${dy})`}
                  onClick={() => toggleSelect(m.detail.employeeId)}
                >
                  <title>
                    {m.detail.employeeName}: {m.detail.projectsActive} activo(s),{' '}
                    {m.overdueCount} atrasado(s) — {STATUS_INFO[m.detail.semaphoreLevel].label}
                  </title>
                  <path d={donutPath(m.startAngle, m.endAngle)} fill={m.detail.color} />
                  {m.overdueCount > 0 && (
                    <path
                      d={donutPath(m.startAngle, m.endAngle)}
                      className="team-pie-overdue-ring"
                    />
                  )}
                  {sweepDeg >= 18 && (
                    <>
                      <text x={label.x} y={label.y - 4} className="team-pie-slice-name">
                        {firstName(m.detail.employeeName)}
                      </text>
                      <text x={label.x} y={label.y + 12} className="team-pie-slice-count">
                        {m.detail.projectsActive} act.
                        {m.overdueCount > 0 ? ` · ${m.overdueCount}⚠` : ''}
                      </text>
                    </>
                  )}
                </g>
              );
            })}

            <circle cx={CENTER} cy={CENTER} r={INNER_R - 6} className="team-pie-hole" />

            {selected ? (
              <>
                <text x={CENTER} y={CENTER - 30} className="team-pie-center-name">
                  {firstName(selected.detail.employeeName)}
                </text>
                <text
                  x={CENTER}
                  y={CENTER - 10}
                  className="team-pie-center-status"
                  fill={STATUS_INFO[selected.detail.semaphoreLevel].color}
                >
                  {STATUS_INFO[selected.detail.semaphoreLevel].label}
                </text>
                <text x={CENTER} y={CENTER + 14} className="team-pie-center-stat">
                  {selected.detail.projectsActive} activos · {selected.overdueCount} atrasados
                </text>
                <text x={CENTER} y={CENTER + 32} className="team-pie-center-stat">
                  {selected.detail.projectsOnTime}/{selected.detail.projectsCompletedMonth} a
                  tiempo · KPI {selected.detail.kpiPercent}
                </text>
              </>
            ) : (
              <>
                <text x={CENTER} y={CENTER - 26} className="team-pie-center-name">
                  Equipo
                </text>
                <text x={CENTER} y={CENTER - 2} className="team-pie-center-stat">
                  {teamTotals.active} activos · {teamTotals.overdue} atrasados
                </text>
                <text x={CENTER} y={CENTER + 16} className="team-pie-center-stat">
                  {teamTotals.onTime}/{teamTotals.delivered} entregas a tiempo
                </text>
                <text x={CENTER} y={CENTER + 38} className="team-pie-center-hint">
                  Toca una rebanada
                </text>
              </>
            )}
          </svg>
        </div>

        <div className="team-pie-cards">
          {pieMembers.map((m) => {
            const status = STATUS_INFO[m.detail.semaphoreLevel];
            const isSelected = m.detail.employeeId === selectedId;
            return (
              <button
                key={m.detail.employeeId}
                type="button"
                className={`team-pie-card team-pie-card--${m.detail.semaphoreLevel}${isSelected ? ' is-selected' : ''}`}
                onClick={() => toggleSelect(m.detail.employeeId)}
              >
                <header>
                  <span className="team-pie-card-dot" style={{ background: m.detail.color }} />
                  <div className="team-pie-card-title">
                    <strong>{m.detail.employeeName}</strong>
                    {m.detail.position && <span>{m.detail.position}</span>}
                  </div>
                  <em className="team-pie-card-status" style={{ color: status.color }}>
                    {status.label}
                  </em>
                </header>
                <div className="team-pie-card-stats">
                  <span>
                    <strong>{m.detail.projectsActive}</strong> activos
                  </span>
                  <span className={m.overdueCount > 0 ? 'is-bad' : ''}>
                    <strong>{m.overdueCount}</strong> atrasados
                  </span>
                  <span>
                    <strong>
                      {m.detail.projectsOnTime}/{m.detail.projectsCompletedMonth}
                    </strong>{' '}
                    a tiempo
                  </span>
                  <span>
                    <strong>{m.detail.kpiPercent}</strong> KPI
                  </span>
                </div>
                {isSelected && (
                  <p className="team-pie-card-message">{m.detail.semaphoreMessage}</p>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
