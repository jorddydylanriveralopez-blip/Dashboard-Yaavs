import { useMemo, useState } from 'react';
import type { CreativeProject } from '../types';
import {
  buildDeliveryMonthlyTrend,
  collectDeliveryMonthKeys,
  listMonthKeysBetween,
} from '../utils/panoramaDelivery';
import { formatMonthLabel, getMonthKey } from '../utils/performanceHistory';
import './PanoramaDeliveryLineChart.css';

const CHART_WIDTH = 640;
const CHART_HEIGHT = 220;
const PAD_LEFT = 44;
const PAD_RIGHT = 16;
const PAD_TOP = 12;
const PAD_BOTTOM = 36;
const Y_TICKS = [0, 25, 50, 75, 100];
const DAY_OPTIONS = Array.from({ length: 31 }, (_, i) => i + 1);

interface Props {
  projects: CreativeProject[];
  extraMonthKeys?: string[];
}

export function PanoramaDeliveryLineChart({ projects, extraMonthKeys = [] }: Props) {
  const availableMonths = useMemo(
    () => collectDeliveryMonthKeys(projects, extraMonthKeys),
    [projects, extraMonthKeys],
  );

  const defaultFrom = availableMonths[Math.max(0, availableMonths.length - 6)] ?? getMonthKey();
  const defaultTo = availableMonths[availableMonths.length - 1] ?? getMonthKey();

  const [monthFrom, setMonthFrom] = useState(defaultFrom);
  const [monthTo, setMonthTo] = useState(defaultTo);
  const [dayFrom, setDayFrom] = useState(1);
  const [dayTo, setDayTo] = useState(31);

  const monthKeys = useMemo(
    () => listMonthKeysBetween(monthFrom, monthTo),
    [monthFrom, monthTo],
  );

  const points = useMemo(
    () => buildDeliveryMonthlyTrend(projects, monthKeys, dayFrom, dayTo),
    [projects, monthKeys, dayFrom, dayTo],
  );

  const isFullDayRange = dayFrom === 1 && dayTo === 31;
  const hasDeliveries = points.some((p) => p.delivered > 0);

  const chartW = CHART_WIDTH - PAD_LEFT - PAD_RIGHT;
  const chartH = CHART_HEIGHT - PAD_TOP - PAD_BOTTOM;

  const xForIndex = (index: number, total: number) => {
    if (total <= 1) return PAD_LEFT + chartW / 2;
    return PAD_LEFT + (index / (total - 1)) * chartW;
  };

  const yForPercent = (percent: number) => PAD_TOP + chartH - (percent / 100) * chartH;

  const lineSegments = useMemo(() => {
    const segments: string[] = [];
    let current = '';

    for (let i = 0; i < points.length; i++) {
      const pct = points[i].onTimePercent;
      if (pct === null) {
        if (current) {
          segments.push(current);
          current = '';
        }
        continue;
      }
      const x = xForIndex(i, points.length);
      const y = yForPercent(pct);
      current += current ? ` L ${x} ${y}` : `M ${x} ${y}`;
    }

    if (current) segments.push(current);
    return segments;
  }, [points]);

  const rangeSummary = useMemo(() => {
    const delivered = points.reduce((sum, p) => sum + p.delivered, 0);
    const onTime = points.reduce((sum, p) => sum + p.onTime, 0);
    const percent = delivered === 0 ? 0 : Math.round((onTime / delivered) * 100);
    return { delivered, onTime, late: delivered - onTime, percent };
  }, [points]);

  const handleMonthFromChange = (value: string) => {
    setMonthFrom(value);
    if (value > monthTo) setMonthTo(value);
  };

  const handleMonthToChange = (value: string) => {
    setMonthTo(value);
    if (value < monthFrom) setMonthFrom(value);
  };

  const handleDayFromChange = (value: number) => {
    setDayFrom(value);
    if (value > dayTo) setDayTo(value);
  };

  const handleDayToChange = (value: number) => {
    setDayTo(value);
    if (value < dayFrom) setDayFrom(value);
  };

  return (
    <section className="pulse-delivery-line" aria-label="Entregas a tiempo por mes">
      <div className="pulse-delivery-line-head">
        <div>
          <h2>Entregas a tiempo</h2>
          <p>
            {formatMonthLabel(monthFrom)} — {formatMonthLabel(monthTo)}
            {!isFullDayRange && ` · del día ${Math.min(dayFrom, dayTo)} al ${Math.max(dayFrom, dayTo)}`}
            {' · '}
            % de proyectos entregados dentro de fecha (0–100%)
          </p>
        </div>
        <div className="pulse-delivery-line-controls">
          <label className="pulse-delivery-line-filter">
            Desde mes
            <select value={monthFrom} onChange={(e) => handleMonthFromChange(e.target.value)}>
              {availableMonths.map((m) => (
                <option key={m} value={m}>
                  {formatMonthLabel(m)}
                </option>
              ))}
            </select>
          </label>
          <label className="pulse-delivery-line-filter">
            Hasta mes
            <select value={monthTo} onChange={(e) => handleMonthToChange(e.target.value)}>
              {availableMonths.map((m) => (
                <option key={m} value={m}>
                  {formatMonthLabel(m)}
                </option>
              ))}
            </select>
          </label>
          <label className="pulse-delivery-line-filter">
            Del día
            <select
              value={dayFrom}
              onChange={(e) => handleDayFromChange(Number(e.target.value))}
            >
              {DAY_OPTIONS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </label>
          <label className="pulse-delivery-line-filter">
            Al día
            <select value={dayTo} onChange={(e) => handleDayToChange(Number(e.target.value))}>
              {DAY_OPTIONS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </label>
          {!isFullDayRange && (
            <button
              type="button"
              className="pulse-delivery-line-reset"
              onClick={() => {
                setDayFrom(1);
                setDayTo(31);
              }}
            >
              Mes completo
            </button>
          )}
        </div>
      </div>

      <div className="pulse-delivery-line-summary">
        <span className="pulse-delivery-line-summary-item pulse-delivery-line-summary-item--up">
          <strong>{rangeSummary.percent}%</strong> a tiempo
        </span>
        <span className="pulse-delivery-line-summary-item">
          <strong>{rangeSummary.onTime}</strong> a tiempo
        </span>
        <span className="pulse-delivery-line-summary-item pulse-delivery-line-summary-item--late">
          <strong>{rangeSummary.late}</strong> tarde
        </span>
        <span className="pulse-delivery-line-summary-item">
          <strong>{rangeSummary.delivered}</strong> entregados
        </span>
      </div>

      {!hasDeliveries ? (
        <p className="pulse-delivery-line-empty">
          No hay proyectos entregados en el rango seleccionado.
        </p>
      ) : (
        <div className="pulse-delivery-line-chart-wrap">
          <svg
            className="pulse-delivery-line-chart"
            viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
            role="img"
            aria-label="Gráfica de entregas a tiempo por mes"
          >
            {Y_TICKS.map((tick) => {
              const y = yForPercent(tick);
              return (
                <g key={tick}>
                  <line
                    x1={PAD_LEFT}
                    y1={y}
                    x2={CHART_WIDTH - PAD_RIGHT}
                    y2={y}
                    className="pulse-delivery-line-grid"
                  />
                  <text x={PAD_LEFT - 8} y={y + 4} className="pulse-delivery-line-y-label">
                    {tick}%
                  </text>
                </g>
              );
            })}

            {lineSegments.map((d, i) => (
              <path key={i} d={d} className="pulse-delivery-line-path" />
            ))}

            {points.map((point, i) => {
              if (point.onTimePercent === null) return null;
              const x = xForIndex(i, points.length);
              const y = yForPercent(point.onTimePercent);
              const tone =
                point.onTimePercent >= 80
                  ? 'good'
                  : point.onTimePercent >= 50
                    ? 'mid'
                    : 'low';
              return (
                <g key={point.monthKey}>
                  <circle
                    cx={x}
                    cy={y}
                    r={5}
                    className={`pulse-delivery-line-dot pulse-delivery-line-dot--${tone}`}
                  >
                    <title>
                      {point.monthLabel}: {point.onTimePercent}% a tiempo ({point.onTime} de{' '}
                      {point.delivered})
                    </title>
                  </circle>
                  <text x={x} y={CHART_HEIGHT - 10} className="pulse-delivery-line-x-label">
                    {point.shortLabel}
                  </text>
                  <text x={x} y={y - 10} className="pulse-delivery-line-value">
                    {point.onTimePercent}%
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      )}

      <p className="pulse-delivery-line-legend">
        <span className="pulse-delivery-line-legend-good">● ≥80% a tiempo</span>
        <span className="pulse-delivery-line-legend-mid">● 50–79%</span>
        <span className="pulse-delivery-line-legend-low">● &lt;50%</span>
      </p>
    </section>
  );
}
