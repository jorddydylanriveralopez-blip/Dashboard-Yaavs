import { useMemo } from 'react';
import type { PieSlice } from '../utils/dailyKpiSnapshots';
import './PieChart.css';

interface Props {
  slices: PieSlice[];
  size?: number;
  title?: string;
  centerValue?: string | number;
  centerSuffix?: string;
  centerLabel?: string;
  legendMode?: 'kpi' | 'share' | 'attendance';
}

export function PieChart({
  slices,
  size = 220,
  title = 'Distribución del equipo',
  centerValue,
  centerSuffix,
  centerLabel = 'promedio',
  legendMode = 'kpi',
}: Props) {
  const gradient = useMemo(() => {
    if (slices.length === 0) return 'conic-gradient(#e7e5e4 0deg 360deg)';
    const total = slices.reduce((s, sl) => s + sl.value, 0);
    let cursor = 0;
    const stops: string[] = [];
    for (const sl of slices) {
      const deg = (sl.value / total) * 360;
      const end = cursor + deg;
      stops.push(`${sl.color} ${cursor}deg ${end}deg`);
      cursor = end;
    }
    return `conic-gradient(${stops.join(', ')})`;
  }, [slices]);

  if (slices.length === 0) {
    return null;
  }

  const defaultCenter =
    slices.reduce((s, sl) => s + sl.kpiPercent, 0) > 0
      ? Math.round(slices.reduce((s, sl) => s + sl.kpiPercent, 0) / slices.length)
      : 0;
  const holeValue = centerValue ?? defaultCenter;
  const suffix =
    centerSuffix ?? (centerValue === undefined && typeof holeValue === 'number' ? '%' : '');

  return (
    <div className="pie-chart pie-chart--animate">
      <div
        className="pie-chart-ring pie-chart-ring--animate"
        style={{ width: size, height: size, background: gradient }}
        role="img"
        aria-label={title}
      >
        <div className="pie-chart-hole pie-chart-hole--animate">
          <strong>
            {holeValue}
            {suffix}
          </strong>
          <span>{centerLabel}</span>
        </div>
      </div>
      <ul className="pie-chart-legend">
        {slices.map((sl, i) => (
          <li key={sl.id} style={{ ['--legend-i' as string]: i }}>
            <span className="pie-chart-dot" style={{ background: sl.color }} />
            <div className="pie-chart-legend-text">
              <strong>{sl.label}</strong>
              <span>
                {legendMode === 'share'
                  ? `${sl.sharePercent}% · ${sl.value} ${sl.value === 1 ? 'pieza' : 'piezas'}`
                  : legendMode === 'attendance'
                    ? `${sl.sharePercent}% · ${sl.value} ${sl.value === 1 ? 'día' : 'días'}`
                    : `Avance actual: ${sl.kpiPercent} de 100`}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
