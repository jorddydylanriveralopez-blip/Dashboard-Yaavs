import { useMemo } from 'react';
import type { DailyPulsePoint } from '../utils/dailyKpiSnapshots';
import './DailyPulseChart.css';

interface Props {
  employeeName: string;
  color: string;
  series: DailyPulsePoint[];
  compact?: boolean;
}

export function DailyPulseChart({ employeeName, color, series, compact }: Props) {
  const display = useMemo(() => {
    const recent = series.slice(-14);
    const maxKpi = Math.max(100, ...recent.map((p) => p.kpiPercent), 1);
    return { recent, maxKpi };
  }, [series]);

  if (display.recent.length === 0) {
    return (
      <article className={`daily-pulse daily-pulse--empty ${compact ? 'daily-pulse--compact' : ''}`}>
        <h3>{employeeName}</h3>
        <p>Aún no hay registro diario este mes.</p>
      </article>
    );
  }

  const last = display.recent[display.recent.length - 1];
  const daysUp = display.recent.filter((p) => p.progressed && p.deltaPercent > 0).length;
  const daysFlat = display.recent.filter((p) => !p.progressed && !p.missing).length;

  return (
    <article className={`daily-pulse ${compact ? 'daily-pulse--compact' : ''}`}>
      <header className="daily-pulse-head">
        <div className="daily-pulse-avatar" style={{ background: color }}>
          {employeeName.charAt(0)}
        </div>
        <div>
          <h3>{employeeName}</h3>
          <span className="daily-pulse-kpi">Hoy: {last.kpiPercent}%</span>
        </div>
        <div className="daily-pulse-badges">
          <span className="daily-pulse-badge daily-pulse-badge--up">↑ {daysUp}</span>
          <span className="daily-pulse-badge daily-pulse-badge--down">→ {daysFlat}</span>
        </div>
      </header>

      <div
        className="daily-pulse-chart"
        role="img"
        aria-label={`Ritmo diario de ${employeeName}`}
      >
        {display.recent.map((point) => {
          const height = Math.max(8, (point.kpiPercent / display.maxKpi) * 100);
          const tone = point.missing
            ? 'missing'
            : point.progressed && point.deltaPercent > 0
              ? 'up'
              : point.deltaPercent < 0
                ? 'down'
                : 'flat';
          return (
            <div key={point.dateKey} className="daily-pulse-col" title={`${point.dayLabel}: ${point.kpiPercent}%`}>
              <span className={`daily-pulse-arrow daily-pulse-arrow--${tone}`}>
                {tone === 'up' ? '↑' : tone === 'down' ? '↓' : tone === 'missing' ? '·' : '→'}
              </span>
              <div className="daily-pulse-bar-wrap">
                <div
                  className={`daily-pulse-bar daily-pulse-bar--${tone}`}
                  style={{ height: `${height}%`, background: tone === 'up' ? color : undefined }}
                />
              </div>
              <span className="daily-pulse-day">{point.dayLabel.split(' ')[0]}</span>
            </div>
          );
        })}
      </div>

      <p className="daily-pulse-legend">
        <span className="daily-pulse-legend-up">↑ Subió</span>
        <span className="daily-pulse-legend-down">↓ Bajó</span>
        <span className="daily-pulse-legend-flat">→ Sin avance</span>
      </p>
    </article>
  );
}
