import { PieChart } from './PieChart';
import {
  ATTENDANCE_STATUS_COLORS,
  ATTENDANCE_STATUS_LABELS,
  attendancePerformancePercent,
  buildAttendancePieSlices,
  type AttendanceSummary,
} from '../utils/attendance';
import type { AttendanceStatus } from '../types';
import type { PieSlice } from '../utils/dailyKpiSnapshots';
import './AttendanceMemberPie.css';

interface Props {
  name: string;
  avatarColor: string;
  summary: AttendanceSummary;
  monthLabel: string;
  index?: number;
}

const STAT_ORDER: AttendanceStatus[] = ['present', 'late', 'absent', 'sick', 'vacation'];

function toPieSlices(slices: ReturnType<typeof buildAttendancePieSlices>): PieSlice[] {
  return slices.map((s) => ({
    id: s.id,
    label: s.label,
    value: s.value,
    color: s.color,
    kpiPercent: s.sharePercent,
    sharePercent: s.sharePercent,
  }));
}

function rateTone(rate: number): 'great' | 'ok' | 'warn' | 'empty' {
  if (rate >= 80) return 'great';
  if (rate >= 60) return 'ok';
  if (rate > 0) return 'warn';
  return 'empty';
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function AttendanceMemberPie({
  name,
  avatarColor,
  summary,
  monthLabel,
  index = 0,
}: Props) {
  const slices = buildAttendancePieSlices(summary);
  const rate = attendancePerformancePercent(summary);
  const totalDays = summary.totalMarked;
  const tone = rateTone(rate);
  const hasData = slices.length > 0;

  return (
    <article
      className={`attendance-member-pie attendance-member-pie--${tone}${hasData ? '' : ' is-empty'}`}
      style={{ ['--amp-i' as string]: index, ['--amp-accent' as string]: avatarColor }}
    >
      <header className="attendance-member-pie-head">
        <span className="attendance-member-pie-avatar" aria-hidden>
          {initials(name)}
        </span>
        <div className="attendance-member-pie-identity">
          <strong>{name}</strong>
          <span>{monthLabel}</span>
        </div>
        {hasData && (
          <div className="attendance-member-pie-score" aria-label={`${rate}% de asistencia`}>
            <em>{rate}%</em>
            <span>puntual</span>
          </div>
        )}
      </header>

      {!hasData ? (
        <div className="attendance-member-pie-empty">
          <div className="attendance-member-pie-empty-ring" aria-hidden />
          <p>Sin registros este mes</p>
          <span>Cuando haya marcas del checador, aquí verás su pastel.</span>
        </div>
      ) : (
        <div className="attendance-member-pie-body">
          <div className="attendance-member-pie-chart">
            <PieChart
              slices={toPieSlices(slices)}
              size={132}
              title={`Asistencia de ${name}`}
              centerValue={rate}
              centerSuffix="%"
              centerLabel="ok"
              legendMode="attendance"
            />
          </div>

          <ul className="attendance-member-pie-stats">
            {STAT_ORDER.map((status) => {
              const count = summary[status];
              if (!count) return null;
              const pct = totalDays ? Math.round((count / totalDays) * 100) : 0;
              return (
                <li key={status}>
                  <div className="attendance-member-pie-stat-top">
                    <span
                      className="attendance-member-pie-stat-dot"
                      style={{ background: ATTENDANCE_STATUS_COLORS[status] }}
                    />
                    <strong>{ATTENDANCE_STATUS_LABELS[status]}</strong>
                    <em>
                      {count}d · {pct}%
                    </em>
                  </div>
                  <div
                    className="attendance-member-pie-stat-bar"
                    role="presentation"
                    aria-hidden
                  >
                    <i
                      style={{
                        width: `${pct}%`,
                        background: ATTENDANCE_STATUS_COLORS[status],
                      }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {hasData && (
        <footer className="attendance-member-pie-foot">
          <span>{totalDays} días con marca</span>
          <span className={`attendance-member-pie-badge attendance-member-pie-badge--${tone}`}>
            {tone === 'great' ? 'Excelente' : tone === 'ok' ? 'En rango' : 'Revisar retardos'}
          </span>
        </footer>
      )}
    </article>
  );
}
