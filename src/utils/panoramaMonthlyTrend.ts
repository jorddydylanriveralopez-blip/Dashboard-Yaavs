import type {
  AttendanceStore,
  CreativeProject,
  DailyKpiStore,
  EmployeeTask,
  PerformanceHistoryStore,
} from '../types';
import { buildPanoramaMemberDetails } from './panoramaDetail';
import { buildMonthPulseSummary } from './dailyKpiSnapshots';
import { buildPanoramaSemaphores } from './exportPanorama';
import { formatMonthLabel, getMonthKey, recordsForMonth } from './performanceHistory';

export interface PanoramaMonthlyTrendRow {
  monthKey: string;
  monthLabel: string;
  shortMonthLabel: string;
  isCurrentMonth: boolean;
  hasData: boolean;
  teamAvg: number | null;
  monthImprovement: number | null;
  vsPreviousMonth: number | null;
  improved: boolean | null;
  strengths: string[];
  opportunities: string[];
}

function shortMonthLabel(monthKey: string): string {
  const [y, m] = monthKey.split('-').map(Number);
  const d = new Date(y, m - 1, 1);
  const month = d.toLocaleDateString('es-MX', { month: 'long' });
  return `${month.charAt(0).toUpperCase()}${month.slice(1)}`;
}

export function lastNMonthKeys(count: number, from = new Date()): string[] {
  const keys: string[] = [];
  const anchor = new Date(from.getFullYear(), from.getMonth(), 1);
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(anchor.getFullYear(), anchor.getMonth() - i, 1);
    keys.push(getMonthKey(d));
  }
  return keys;
}

function teamAvgFromHistory(
  performanceHistory: PerformanceHistoryStore,
  monthKey: string,
): number | null {
  const records = recordsForMonth(performanceHistory, monthKey).filter(
    (r) => r.employeeId !== 'emp-orlando',
  );
  if (records.length === 0) return null;
  return Math.round(records.reduce((sum, r) => sum + r.kpiPercent, 0) / records.length);
}

function hasSnapshotData(store: DailyKpiStore, monthKey: string): boolean {
  return store.snapshots.some((s) => s.monthKey === monthKey);
}

function aggregateInsights(
  members: ReturnType<typeof buildPanoramaMemberDetails>,
): { strengths: string[]; opportunities: string[] } {
  const strengthCounts = new Map<string, number>();
  const oppCounts = new Map<string, number>();

  for (const member of members) {
    for (const text of member.strengths) {
      strengthCounts.set(text, (strengthCounts.get(text) ?? 0) + 1);
    }
    for (const text of member.improvements) {
      oppCounts.set(text, (oppCounts.get(text) ?? 0) + 1);
    }
  }

  const sortByCount = (map: Map<string, number>) =>
    [...map.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([text]) => text);

  return {
    strengths: sortByCount(strengthCounts).slice(0, 3),
    opportunities: sortByCount(oppCounts).slice(0, 4),
  };
}

function teamOpportunitiesFromMetrics(
  members: ReturnType<typeof buildPanoramaMemberDetails>,
  teamAvg: number,
): string[] {
  const extra: string[] = [];
  const lowKpi = members.filter((m) => m.kpiPercent < teamAvg - 8);
  const attendanceIssues = members.filter((m) => m.attendanceRate < 80);
  const undelivered = members.filter((m) => m.undeliveredProjects.length > 0);
  const late = members.filter((m) => m.projectsLate > 0);

  if (lowKpi.length >= 2) {
    extra.push(
      `${lowKpi.length} colaborador(es) por debajo del promedio del equipo.`,
    );
  }
  if (attendanceIssues.length >= 2) {
    extra.push('Reforzar asistencia y puntualidad en varias personas.');
  }
  if (undelivered.length >= 2) {
    extra.push('Cerrar proyectos activos pendientes antes de fin de mes.');
  }
  if (late.length >= 2) {
    extra.push('Mejorar cumplimiento de fechas de compromiso.');
  }

  return extra;
}

export function buildPanoramaMonthlyTrend(input: {
  monthKeys?: string[];
  tasks: EmployeeTask[];
  dailyKpiStore: DailyKpiStore;
  allProjects: CreativeProject[];
  attendanceStore: AttendanceStore;
  performanceHistory: PerformanceHistoryStore;
}): PanoramaMonthlyTrendRow[] {
  const teamTasks = input.tasks.filter((t) => t.employeeId !== 'emp-orlando');
  const currentMonth = getMonthKey();
  const monthKeys = input.monthKeys ?? lastNMonthKeys(6);
  const semaphores = buildPanoramaSemaphores(input.allProjects);

  const rows: PanoramaMonthlyTrendRow[] = [];
  let previousAvg: number | null = null;

  for (const monthKey of monthKeys) {
    const isCurrentMonth = monthKey === currentMonth;
    const snapshotData = hasSnapshotData(input.dailyKpiStore, monthKey);
    const summary = buildMonthPulseSummary(input.dailyKpiStore, teamTasks, monthKey);
    const historyAvg = teamAvgFromHistory(input.performanceHistory, monthKey);

    let teamAvg: number | null = null;
    let monthImprovement: number | null = null;

    if (snapshotData && summary.members.length > 0) {
      teamAvg = summary.teamAvg;
      monthImprovement = Math.round(
        summary.members.reduce((sum, m) => sum + m.change, 0) / summary.members.length,
      );
    } else if (historyAvg !== null) {
      teamAvg = historyAvg;
    } else if (isCurrentMonth && teamTasks.length > 0) {
      teamAvg = summary.teamAvg > 0 ? summary.teamAvg : null;
      if (summary.members.length > 0) {
        monthImprovement = Math.round(
          summary.members.reduce((sum, m) => sum + m.change, 0) / summary.members.length,
        );
      }
    }

    const members =
      teamAvg !== null
        ? buildPanoramaMemberDetails({
            monthKey,
            tasks: teamTasks,
            dailyKpiStore: input.dailyKpiStore,
            allProjects: input.allProjects,
            attendanceStore: input.attendanceStore,
            semaphores,
          })
        : [];

    const { strengths, opportunities: memberOpps } = aggregateInsights(members);
    const metricOpps = teamAvg !== null ? teamOpportunitiesFromMetrics(members, teamAvg) : [];
    const opportunities = [...new Set([...memberOpps, ...metricOpps])].slice(0, 4);

    const vsPreviousMonth =
      teamAvg !== null && previousAvg !== null ? teamAvg - previousAvg : null;

    const improved =
      vsPreviousMonth === null ? null : vsPreviousMonth > 0;

    rows.push({
      monthKey,
      monthLabel: formatMonthLabel(monthKey),
      shortMonthLabel: shortMonthLabel(monthKey),
      isCurrentMonth,
      hasData: teamAvg !== null,
      teamAvg,
      monthImprovement,
      vsPreviousMonth,
      improved,
      strengths,
      opportunities,
    });

    if (teamAvg !== null) previousAvg = teamAvg;
  }

  return rows;
}

export function formatTrendDelta(value: number | null): string {
  if (value === null) return '—';
  if (value === 0) return '0 pts';
  return `${value > 0 ? '+' : ''}${value} pts`;
}
