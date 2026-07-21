import { PieChart } from './PieChart';
import {
  attendancePerformancePercent,
  buildAttendancePieSlices,
  type AttendanceSummary,
} from '../utils/attendance';
import type { PieSlice } from '../utils/dailyKpiSnapshots';
import './AttendanceMemberPie.css';

interface Props {
  name: string;
  avatarColor: string;
  summary: AttendanceSummary;
  monthLabel: string;
}

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

export function AttendanceMemberPie({ name, avatarColor, summary, monthLabel }: Props) {
  const slices = buildAttendancePieSlices(summary);
  const rate = attendancePerformancePercent(summary);
  const totalDays = summary.totalMarked;

  return (
    <article className="attendance-member-pie">
      <header className="attendance-member-pie-head">
        <span className="attendance-member-pie-avatar" style={{ background: avatarColor }}>
          {name.charAt(0)}
        </span>
        <div>
          <strong>{name}</strong>
          <span>{monthLabel}</span>
        </div>
      </header>

      {slices.length === 0 ? (
        <p className="attendance-member-pie-empty">Sin registros este mes</p>
      ) : (
        <div className="attendance-member-pie-chart">
          <PieChart
            slices={toPieSlices(slices)}
            size={150}
            title={`Asistencia de ${name}`}
            centerValue={rate}
            centerSuffix="%"
            centerLabel="asistencia"
            legendMode="attendance"
          />
          <p className="attendance-member-pie-meta">
            {totalDays} {totalDays === 1 ? 'día registrado' : 'días registrados'}
          </p>
        </div>
      )}
    </article>
  );
}
