import type { DailyKpiSnapshot, DailyKpiStore, EmployeeTask } from '../types';
import { kpiPercent } from './kpiStats';
import { getMonthKey } from './performanceHistory';

const MAX_SNAPSHOT_AGE_DAYS = 120;

export function todayKey(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export function yesterdayKey(from = new Date()): string {
  const d = new Date(from);
  d.setDate(d.getDate() - 1);
  return todayKey(d);
}

function snapshotId(employeeId: string, dateKey: string): string {
  return `${employeeId}-${dateKey}`;
}

function pruneOldSnapshots(snapshots: DailyKpiSnapshot[]): DailyKpiSnapshot[] {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - MAX_SNAPSHOT_AGE_DAYS);
  const minKey = todayKey(cutoff);
  return snapshots.filter((s) => s.dateKey >= minKey);
}

export function recordDailySnapshots(
  store: DailyKpiStore,
  tasks: EmployeeTask[],
  date = new Date(),
): DailyKpiStore {
  const dateKey = todayKey(date);
  const monthKey = getMonthKey(date);
  const prevKey = yesterdayKey(date);
  const byId = new Map(store.snapshots.map((s) => [s.id, s]));
  const now = date.toISOString();

  for (const task of tasks) {
    const id = snapshotId(task.employeeId, dateKey);
    const prev = byId.get(snapshotId(task.employeeId, prevKey));
    const pct = kpiPercent(task);
    const prevPct = prev?.kpiPercent ?? 0;
    const deltaPercent = pct - prevPct;
    const progressed = deltaPercent > 0 || task.status === 'completado';

    byId.set(id, {
      id,
      employeeId: task.employeeId,
      employeeName: task.employeeName,
      dateKey,
      monthKey,
      kpiPercent: pct,
      kpiCurrent: task.kpiCurrent,
      kpiTarget: task.kpiTarget,
      status: task.status,
      progressed,
      deltaPercent,
      recordedAt: now,
    });
  }

  return { snapshots: pruneOldSnapshots([...byId.values()]) };
}

export interface PieSlice {
  id: string;
  label: string;
  value: number;
  color: string;
  kpiPercent: number;
  sharePercent: number;
}

/** Porciones del pastel: peso = KPI actual de cada persona. */
export function buildTeamPieSlices(tasks: EmployeeTask[]): PieSlice[] {
  if (tasks.length === 0) return [];
  const total = tasks.reduce((sum, t) => sum + Math.max(1, kpiPercent(t)), 0);
  return tasks
    .map((t) => {
      const kpi = kpiPercent(t);
      const weight = Math.max(1, kpi);
      return {
        id: t.employeeId,
        label: t.employeeName,
        value: weight,
        color: t.avatarColor,
        kpiPercent: kpi,
        sharePercent: Math.round((weight / total) * 100),
      };
    })
    .sort((a, b) => b.kpiPercent - a.kpiPercent);
}

export interface DailyPulsePoint {
  dateKey: string;
  dayLabel: string;
  kpiPercent: number;
  progressed: boolean;
  deltaPercent: number;
  missing: boolean;
}

export function buildDailyPulseSeries(
  store: DailyKpiStore,
  employeeId: string,
  monthKey = getMonthKey(),
): DailyPulsePoint[] {
  const monthSnaps = store.snapshots
    .filter((s) => s.employeeId === employeeId && s.monthKey === monthKey)
    .sort((a, b) => a.dateKey.localeCompare(b.dateKey));

  if (monthSnaps.length === 0) return [];

  const [y, m] = monthKey.split('-').map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const today = todayKey();
  const byDate = new Map(monthSnaps.map((s) => [s.dateKey, s]));
  const series: DailyPulsePoint[] = [];

  for (let day = 1; day <= daysInMonth; day++) {
    const dateKey = `${monthKey}-${String(day).padStart(2, '0')}`;
    if (dateKey > today) break;
    const snap = byDate.get(dateKey);
    const d = new Date(y, m - 1, day);
    const dayLabel = d.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric' });
    if (!snap) {
      series.push({
        dateKey,
        dayLabel,
        kpiPercent: 0,
        progressed: false,
        deltaPercent: 0,
        missing: true,
      });
      continue;
    }
    series.push({
      dateKey,
      dayLabel,
      kpiPercent: snap.kpiPercent,
      progressed: snap.progressed,
      deltaPercent: snap.deltaPercent,
      missing: false,
    });
  }

  return series;
}

export interface MonthPulseSummary {
  monthKey: string;
  monthLabel: string;
  teamAvg: number;
  daysTracked: number;
  daysProgressed: number;
  bestDay: { dateKey: string; avgKpi: number } | null;
  members: {
    employeeId: string;
    employeeName: string;
    startKpi: number;
    endKpi: number;
    change: number;
    daysUp: number;
    daysDown: number;
    color: string;
  }[];
}

export function buildMonthPulseSummary(
  store: DailyKpiStore,
  tasks: EmployeeTask[],
  monthKey = getMonthKey(),
): MonthPulseSummary {
  const monthLabel = new Date(
    Number(monthKey.slice(0, 4)),
    Number(monthKey.slice(5, 7)) - 1,
    1,
  ).toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });

  const monthSnaps = store.snapshots.filter((s) => s.monthKey === monthKey);
  const daysTracked = new Set(monthSnaps.map((s) => s.dateKey)).size;
  const daysProgressed = monthSnaps.filter((s) => s.progressed).length;

  const byDate = new Map<string, number[]>();
  for (const s of monthSnaps) {
    const list = byDate.get(s.dateKey) ?? [];
    list.push(s.kpiPercent);
    byDate.set(s.dateKey, list);
  }

  let bestDay: MonthPulseSummary['bestDay'] = null;
  for (const [dateKey, pcts] of byDate) {
    const avg = Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length);
    if (!bestDay || avg > bestDay.avgKpi) bestDay = { dateKey, avgKpi: avg };
  }

  const members = tasks.map((t) => {
    const series = buildDailyPulseSeries(store, t.employeeId, monthKey).filter((p) => !p.missing);
    const startKpi = series[0]?.kpiPercent ?? 0;
    const endKpi = series[series.length - 1]?.kpiPercent ?? kpiPercent(t);
    const daysUp = series.filter((p) => p.progressed && p.deltaPercent > 0).length;
    const daysDown = series.filter((p) => !p.progressed && p.deltaPercent <= 0 && p.dateKey !== series[0]?.dateKey).length;
    return {
      employeeId: t.employeeId,
      employeeName: t.employeeName,
      startKpi,
      endKpi,
      change: endKpi - startKpi,
      daysUp,
      daysDown,
      color: t.avatarColor,
    };
  });

  const teamAvg =
    members.length === 0
      ? 0
      : Math.round(members.reduce((s, m) => s + m.endKpi, 0) / members.length);

  return {
    monthKey,
    monthLabel,
    teamAvg,
    daysTracked,
    daysProgressed,
    bestDay,
    members,
  };
}

export function snapshotsForEmployee(
  store: DailyKpiStore,
  employeeId: string,
  monthKey = getMonthKey(),
): DailyKpiSnapshot[] {
  return store.snapshots
    .filter((s) => s.employeeId === employeeId && s.monthKey === monthKey)
    .sort((a, b) => a.dateKey.localeCompare(b.dateKey));
}
