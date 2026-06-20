import type {
  BoardState,
  CreativeProject,
  EmployeeTask,
  MonthlyArchiveSnapshot,
  MonthlyArchiveStore,
  MonthlyPerformanceRecord,
  PerformanceHistoryStore,
  TaskAssignment,
} from '../types';
import { isActiveProject } from './activeItems';
import {
  closeMonthForTasks,
  formatMonthLabel,
  getMonthKey,
  getPreviousMonthKey,
  recordsForMonth,
} from './performanceHistory';

export function dateInMonth(iso: string | undefined, monthKey: string): boolean {
  if (!iso) return false;
  return iso.slice(0, 7) === monthKey;
}

export function nextMonthKey(monthKey: string): string {
  const [y, m] = monthKey.split('-').map(Number);
  const d = new Date(y, m, 1);
  return getMonthKey(d);
}

function projectsCompletedInMonth(
  projects: CreativeProject[],
  monthKey: string,
): CreativeProject[] {
  return projects.filter((p) => {
    const finished = p.finishedDate ?? p.completedAt ?? p.updatedAt;
    return dateInMonth(finished, monthKey);
  });
}

function assignmentsInMonth(
  assignments: TaskAssignment[],
  monthKey: string,
): TaskAssignment[] {
  return assignments.filter(
    (a) =>
      dateInMonth(a.createdAt, monthKey) ||
      dateInMonth(a.respondedAt, monthKey) ||
      dateInMonth(a.dueDate, monthKey),
  );
}

function averageKpi(records: MonthlyPerformanceRecord[]): number {
  if (records.length === 0) return 0;
  const sum = records.reduce((acc, r) => acc + r.kpiPercent, 0);
  return Math.round(sum / records.length);
}

export function buildMonthSnapshot(
  monthKey: string,
  board: BoardState,
  assignments: TaskAssignment[],
  tasks: EmployeeTask[],
  performanceHistory: PerformanceHistoryStore,
  closedBy: 'auto' | 'manager',
): MonthlyArchiveSnapshot {
  const projects = board.projects ?? [];
  const completed = projectsCompletedInMonth(projects, monthKey);
  const active = projects.filter(isActiveProject);
  const monthAssignments = assignmentsInMonth(assignments, monthKey);
  const performance = recordsForMonth(performanceHistory, monthKey);

  return {
    monthKey,
    monthLabel: formatMonthLabel(monthKey),
    archivedAt: new Date().toISOString(),
    closedBy,
    performance,
    projectsCompleted: completed,
    projectsActive: active,
    assignments: monthAssignments,
    teamSnapshot: tasks.map((t) => ({ ...t })),
    summary: {
      teamSize: tasks.length,
      projectsCompleted: completed.length,
      projectsActive: active.length,
      assignmentsTotal: monthAssignments.length,
      assignmentsAccepted: monthAssignments.filter((a) => a.status === 'accepted').length,
      assignmentsRejected: monthAssignments.filter((a) => a.status === 'rejected').length,
      kpiAverage: averageKpi(performance),
    },
  };
}

export function upsertSnapshot(
  store: MonthlyArchiveStore,
  snapshot: MonthlyArchiveSnapshot,
): MonthlyArchiveStore {
  const rest = store.snapshots.filter((s) => s.monthKey !== snapshot.monthKey);
  return {
    ...store,
    snapshots: [...rest, snapshot].sort((a, b) => b.monthKey.localeCompare(a.monthKey)),
  };
}

export function getSnapshotForMonth(
  store: MonthlyArchiveStore,
  monthKey: string,
): MonthlyArchiveSnapshot | undefined {
  return store.snapshots.find((s) => s.monthKey === monthKey);
}

export function listArchivedMonthKeys(store: MonthlyArchiveStore): string[] {
  return store.snapshots.map((s) => s.monthKey).sort((a, b) => b.localeCompare(a));
}

/** Reinicia contadores mensuales del equipo para el mes nuevo. */
export function resetTasksForNewMonth(tasks: EmployeeTask[]): EmployeeTask[] {
  return tasks.map((t) => ({
    ...t,
    kpiCurrent: 0,
    status: t.status === 'completado' ? 'sin_empezar' : t.status,
    kpiObjectiveMonthKey: undefined,
    kpiAssignedByName: undefined,
    kpiAssignedAt: undefined,
    objective: 'Objetivo del periodo',
  }));
}

function monthHasActivity(
  monthKey: string,
  board: BoardState,
  assignments: TaskAssignment[],
  tasks: EmployeeTask[],
  performanceHistory: PerformanceHistoryStore,
): boolean {
  if (recordsForMonth(performanceHistory, monthKey).length > 0) return true;
  if (assignmentsInMonth(assignments, monthKey).length > 0) return true;
  if (projectsCompletedInMonth(board.projects ?? [], monthKey).length > 0) return true;
  if (tasks.some((t) => t.kpiCurrent > 0)) return true;
  return false;
}

export interface MonthlyRolloverResult {
  archiveStore: MonthlyArchiveStore;
  performanceHistory: PerformanceHistoryStore;
  board: BoardState;
  archivedMonths: string[];
  didRollover: boolean;
}

/**
 * Al cambiar de mes: archiva meses pendientes, guarda historial KPI y reinicia contadores.
 */
export function ensureMonthlyRollover(
  archiveStore: MonthlyArchiveStore,
  performanceHistory: PerformanceHistoryStore,
  board: BoardState,
  assignments: TaskAssignment[],
  tasks: EmployeeTask[],
): MonthlyRolloverResult {
  const currentKey = getMonthKey();
  if (archiveStore.lastRolloverMonthKey === currentKey) {
    return {
      archiveStore,
      performanceHistory,
      board,
      archivedMonths: [],
      didRollover: false,
    };
  }

  let nextArchive = archiveStore;
  let nextPerf = performanceHistory;
  const archivedMonths: string[] = [];

  const startKey = archiveStore.lastRolloverMonthKey
    ? nextMonthKey(archiveStore.lastRolloverMonthKey)
    : getPreviousMonthKey();

  for (let monthKey = startKey; monthKey < currentKey; monthKey = nextMonthKey(monthKey)) {
    if (getSnapshotForMonth(nextArchive, monthKey)) continue;
    if (!monthHasActivity(monthKey, board, assignments, tasks, nextPerf)) continue;

    nextPerf = closeMonthForTasks(nextPerf, tasks, monthKey, assignments, 'auto');
    const snapshot = buildMonthSnapshot(
      monthKey,
      board,
      assignments,
      tasks,
      nextPerf,
      'auto',
    );
    nextArchive = upsertSnapshot(nextArchive, snapshot);
    archivedMonths.push(monthKey);
  }

  const nextBoard =
    archivedMonths.length > 0
      ? {
          ...board,
          tasks: resetTasksForNewMonth(board.tasks),
        }
      : board;

  return {
    archiveStore: { ...nextArchive, lastRolloverMonthKey: currentKey },
    performanceHistory: {
      ...nextPerf,
      lastAutoCloseMonthKey: currentKey,
    },
    board: nextBoard,
    archivedMonths,
    didRollover: archivedMonths.length > 0,
  };
}

function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function csvEscape(value: string | number): string {
  return `"${String(value).replace(/"/g, '""')}"`;
}

export function exportMonthCsv(snapshot: MonthlyArchiveSnapshot): void {
  const rows: string[][] = [
    ['Yaavs — Respaldo mensual', snapshot.monthLabel],
    ['Archivado', snapshot.archivedAt.slice(0, 16).replace('T', ' ')],
    [],
    ['--- Resumen ---'],
    ['Personas en equipo', String(snapshot.summary.teamSize)],
    ['Proyectos concluidos en el mes', String(snapshot.summary.projectsCompleted)],
    ['Proyectos activos al cierre', String(snapshot.summary.projectsActive)],
    ['Indicaciones del mes', String(snapshot.summary.assignmentsTotal)],
    ['Indicaciones aceptadas', String(snapshot.summary.assignmentsAccepted)],
    ['KPI promedio del equipo', `${snapshot.summary.kpiAverage}%`],
    [],
    ['--- Desempeño por persona ---'],
    [
      'Nombre',
      'KPI %',
      'Calificación',
      'Trabajo actual',
      'Objetivo',
      'Estado',
      'Indic. aceptadas',
      'Indic. rechazadas',
      'Mensaje',
    ],
  ];

  for (const r of snapshot.performance) {
    rows.push([
      r.employeeName,
      String(r.kpiPercent),
      r.rating,
      r.currentWork,
      r.objective,
      r.status,
      String(r.assignmentsAccepted),
      String(r.assignmentsRejected),
      r.message,
    ]);
  }

  rows.push([]);
  rows.push(['--- Proyectos concluidos en el mes ---']);
  rows.push(['Nombre', 'Colaborador', 'Estado', 'Fecha conclusión', 'Solicitó']);
  for (const p of snapshot.projectsCompleted) {
    rows.push([
      p.projectName.trim() || 'Sin nombre',
      p.collaborator,
      p.status,
      (p.finishedDate ?? p.completedAt ?? '').slice(0, 10),
      p.requestedBy,
    ]);
  }

  rows.push([]);
  rows.push(['--- Indicaciones del mes ---']);
  rows.push(['Para', 'Título', 'Estado', 'Vence', 'Creada']);
  for (const a of snapshot.assignments) {
    rows.push([
      a.employeeName,
      a.title,
      a.status,
      a.dueDate,
      a.createdAt.slice(0, 10),
    ]);
  }

  const csv = rows.map((r) => r.map(csvEscape).join(',')).join('\n');
  downloadBlob(
    `yaavs-${snapshot.monthKey}.csv`,
    new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }),
  );
}

export function exportMonthJson(snapshot: MonthlyArchiveSnapshot): void {
  const json = JSON.stringify(snapshot, null, 2);
  downloadBlob(
    `yaavs-${snapshot.monthKey}.json`,
    new Blob([json], { type: 'application/json;charset=utf-8' }),
  );
}

export const MONTH_ROLLOVER_NOTICE_KEY = 'yaavs-month-rollover-notice';

export function stashRolloverNotice(archivedMonths: string[]): void {
  if (archivedMonths.length === 0) return;
  sessionStorage.setItem(
    MONTH_ROLLOVER_NOTICE_KEY,
    JSON.stringify({
      months: archivedMonths.map((k) => ({ key: k, label: formatMonthLabel(k) })),
    }),
  );
}

export function takeRolloverNotice(): { key: string; label: string }[] | null {
  const raw = sessionStorage.getItem(MONTH_ROLLOVER_NOTICE_KEY);
  sessionStorage.removeItem(MONTH_ROLLOVER_NOTICE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { months: { key: string; label: string }[] };
    return parsed.months?.length ? parsed.months : null;
  } catch {
    return null;
  }
}
