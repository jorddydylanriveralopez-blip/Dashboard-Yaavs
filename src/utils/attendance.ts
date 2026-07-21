import { ATTENDANCE_STORAGE_KEY } from '../constants';
import { getMonthKey } from './performanceHistory';
import type {
  AttendanceRecord,
  AttendanceStatus,
  AttendanceStore,
  EmployeeTask,
} from '../types';

export const ATTENDANCE_STATUS_LABELS: Record<AttendanceStatus, string> = {
  present: 'Asistió',
  absent: 'Falta',
  sick: 'Enfermedad',
  late: 'Retardo',
  vacation: 'Vacaciones',
};

export const ATTENDANCE_STATUS_SYMBOL: Record<AttendanceStatus, string> = {
  present: '✓',
  absent: '✗',
  sick: '🏥',
  late: '⏰',
  vacation: '🌴',
};

/** Colores por tipo de asistencia (verde, rojo, amarillo, morado, azul). */
export const ATTENDANCE_STATUS_COLORS: Record<AttendanceStatus, string> = {
  present: '#22c55e',
  absent: '#ef4444',
  late: '#eab308',
  sick: '#a855f7',
  vacation: '#3b82f6',
};

const CYCLE: AttendanceStatus[] = ['present', 'absent', 'sick', 'late', 'vacation'];

export function loadAttendanceStore(): AttendanceStore {
  try {
    const raw = localStorage.getItem(ATTENDANCE_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AttendanceStore;
      if (Array.isArray(parsed.records)) return parsed;
    }
  } catch {
    /* ignore */
  }
  return { records: [] };
}

export function saveAttendanceStore(store: AttendanceStore): void {
  localStorage.setItem(ATTENDANCE_STORAGE_KEY, JSON.stringify(store));
}

export function recordId(employeeId: string, dateKey: string): string {
  return `${employeeId}-${dateKey}`;
}

export function nextAttendanceStatus(current: AttendanceStatus | undefined): AttendanceStatus {
  if (!current) return 'present';
  const idx = CYCLE.indexOf(current);
  return CYCLE[(idx + 1) % CYCLE.length];
}

export function upsertAttendance(
  store: AttendanceStore,
  input: Omit<AttendanceRecord, 'id' | 'updatedAt'> & { id?: string },
): AttendanceStore {
  const id = input.id ?? recordId(input.employeeId, input.dateKey);
  const next: AttendanceRecord = {
    ...input,
    id,
    updatedAt: new Date().toISOString(),
  };
  const rest = store.records.filter((r) => r.id !== id);
  return { records: [...rest, next] };
}

export function getAttendanceForDay(
  store: AttendanceStore,
  employeeId: string,
  dateKey: string,
): AttendanceRecord | undefined {
  return store.records.find((r) => r.employeeId === employeeId && r.dateKey === dateKey);
}

export interface AttendanceSummary {
  employeeId: string;
  employeeName: string;
  present: number;
  absent: number;
  sick: number;
  late: number;
  vacation: number;
  totalMarked: number;
}

export function summarizeAttendance(
  store: AttendanceStore,
  tasks: EmployeeTask[],
  monthKey: string,
): AttendanceSummary[] {
  const monthRecords = store.records.filter((r) => r.monthKey === monthKey);
  return tasks
    .filter((t) => t.employeeId !== 'emp-orlando')
    .map((t) => {
      const mine = monthRecords.filter((r) => r.employeeId === t.employeeId);
      const count = (status: AttendanceStatus) =>
        mine.filter((r) => r.status === status).length;
      return {
        employeeId: t.employeeId,
        employeeName: t.employeeName,
        present: count('present'),
        absent: count('absent'),
        sick: count('sick'),
        late: count('late'),
        vacation: count('vacation'),
        totalMarked: mine.length,
      };
    });
}

export function daysInMonth(monthKey: string, untilToday = true): string[] {
  const [y, m] = monthKey.split('-').map(Number);
  const total = new Date(y, m, 0).getDate();
  const today = new Date().toISOString().slice(0, 10);
  const keys: string[] = [];
  for (let d = 1; d <= total; d++) {
    const dateKey = `${monthKey}-${String(d).padStart(2, '0')}`;
    if (untilToday && dateKey > today) break;
    keys.push(dateKey);
  }
  return keys;
}

export type AttendanceDayTone = AttendanceStatus | 'unset';

export function attendanceDayTone(status: AttendanceStatus | undefined): AttendanceDayTone {
  return status ?? 'unset';
}

export function dominantAttendanceStatus(
  counts: Record<AttendanceStatus, number> & { unset: number },
): AttendanceDayTone {
  const entries: [AttendanceDayTone, number][] = [
    ['present', counts.present],
    ['absent', counts.absent],
    ['sick', counts.sick],
    ['late', counts.late],
    ['vacation', counts.vacation],
    ['unset', counts.unset],
  ];
  return entries.reduce((best, cur) => (cur[1] > best[1] ? cur : best))[0];
}

export function filterDaysByRange(
  days: string[],
  fromDateKey: string,
  toDateKey: string,
): string[] {
  const from = fromDateKey <= toDateKey ? fromDateKey : toDateKey;
  const to = fromDateKey <= toDateKey ? toDateKey : fromDateKey;
  return days.filter((d) => d >= from && d <= to);
}

export function attendancePerformancePercent(summary: AttendanceSummary): number {
  const total =
    summary.present +
    summary.absent +
    summary.sick +
    summary.late +
    summary.vacation;
  if (total === 0) return 0;
  return Math.round((summary.present / total) * 100);
}

export interface AttendancePieSlice {
  id: string;
  label: string;
  value: number;
  color: string;
  sharePercent: number;
}

export function buildAttendancePieSlices(summary: AttendanceSummary): AttendancePieSlice[] {
  const entries: { status: AttendanceStatus; count: number }[] = [
    { status: 'present', count: summary.present },
    { status: 'absent', count: summary.absent },
    { status: 'sick', count: summary.sick },
    { status: 'late', count: summary.late },
    { status: 'vacation', count: summary.vacation },
  ];
  const total = entries.reduce((sum, e) => sum + e.count, 0);
  if (total === 0) return [];

  return entries
    .filter((e) => e.count > 0)
    .map((e) => ({
      id: e.status,
      label: ATTENDANCE_STATUS_LABELS[e.status],
      value: e.count,
      color: ATTENDANCE_STATUS_COLORS[e.status],
      sharePercent: Math.round((e.count / total) * 100),
    }));
}

export function todayDateKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export function defaultSelectedDay(monthKey: string): string {
  const days = daysInMonth(monthKey);
  const today = todayDateKey();
  if (days.includes(today)) return today;
  return days[days.length - 1] ?? `${monthKey}-01`;
}

export function workdaysInMonth(monthKey: string, untilToday = true): string[] {
  const [y, m] = monthKey.split('-').map(Number);
  return daysInMonth(monthKey, untilToday).filter((dateKey) => {
    const d = Number(dateKey.slice(8, 10));
    const dow = new Date(y, m - 1, d).getDay();
    return dow !== 0 && dow !== 6;
  });
}

export function exportAttendanceCsv(
  store: AttendanceStore,
  tasks: EmployeeTask[],
  monthKey: string,
): void {
  const days = workdaysInMonth(monthKey);
  const team = tasks.filter((t) => t.employeeId !== 'emp-orlando');
  const rows: string[][] = [
    ['Colaborador', ...days, 'Asistió', 'Faltas', 'Enfermedad', 'Retardos', 'Vacaciones'],
  ];

  const summary = summarizeAttendance(store, tasks, monthKey);
  for (const t of team) {
    const sum = summary.find((s) => s.employeeId === t.employeeId)!;
    const dayCells = days.map((d) => {
      const rec = getAttendanceForDay(store, t.employeeId, d);
      return rec ? ATTENDANCE_STATUS_LABELS[rec.status] : '';
    });
    rows.push([
      t.employeeName,
      ...dayCells,
      String(sum.present),
      String(sum.absent),
      String(sum.sick),
      String(sum.late),
      String(sum.vacation),
    ]);
  }

  downloadCsv(rows, `yaavs-asistencia-${monthKey}.csv`);
}

function downloadCsv(rows: string[][], filename: string): void {
  const csv = rows
    .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function buildDemoAttendance(
  tasks: EmployeeTask[],
  monthKey = getMonthKey(),
): AttendanceStore {
  const days = workdaysInMonth(monthKey);
  const records: AttendanceRecord[] = [];
  const team = tasks.filter((t) => t.employeeId !== 'emp-orlando');

  for (const t of team) {
    days.forEach((dateKey, i) => {
      let status: AttendanceStatus = 'present';
      const seed = (t.employeeId.charCodeAt(4) + i) % 10;
      if (seed === 0) status = 'absent';
      else if (seed === 1) status = 'sick';
      else if (seed === 2) status = 'late';
      records.push({
        id: recordId(t.employeeId, dateKey),
        employeeId: t.employeeId,
        employeeName: t.employeeName,
        dateKey,
        monthKey,
        status,
        notes: '',
        recordedById: 'u-orlando',
        recordedByName: 'Orlando',
        updatedAt: `${dateKey}T18:00:00.000Z`,
      });
    });
  }

  return { records };
}
