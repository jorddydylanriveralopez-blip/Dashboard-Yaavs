import {
  KPI_NEGATIVE_THRESHOLD,
  KPI_POSITIVE_THRESHOLD,
  NEGATIVE_STREAK_ALERT_MONTHS,
} from '../constants';
import type {
  EmployeeTask,
  MonthlyPerformanceRecord,
  PerformanceHistoryStore,
  PerformanceRating,
  TaskAssignment,
  TaskStatus,
} from '../types';

const POSITIVE_MESSAGES = [
  '¡Excelente mes! Tu esfuerzo impulsa al equipo. Sigue así.',
  'Meta cumplida con creces. Orgullo de tenerte en Yaavs.',
  'Resultados sobresalientes. Este ritmo marca la diferencia.',
  '¡Brillaste este mes! Celebra el logro y comparte lo aprendido.',
];

const REGULAR_MESSAGES = [
  'Vas por buen camino. Un empujón más y cierras el mes con broche de oro.',
  'Avance sólido. Enfócate en lo pendiente para subir tu KPI.',
  'Buen trabajo parcial. Define 2 prioridades claras para el cierre de mes.',
];

const NEGATIVE_MESSAGES = [
  'Este mes costó más, pero cada día es una nueva oportunidad. Estamos contigo.',
  'No alcanzamos la meta, pero tu equipo cree en ti. Hablemos de un plan juntos.',
  'Todavía se puede remontar. Pide apoyo a tu gerente y divide el objetivo en pasos pequeños.',
  'Los tropiezos enseñan. Revisa tu objetivo y pide una indicación clara para arrancar fuerte.',
];

const STREAK_ALERT_MESSAGE =
  'Llevás varios meses con KPI bajo. Tu gerente y Yaavs quieren apoyarte: agenda una reunión y armemos un plan juntos. ¡Tú puedes!';

export function getMonthKey(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export function getPreviousMonthKey(from = new Date()): string {
  const d = new Date(from.getFullYear(), from.getMonth() - 1, 1);
  return getMonthKey(d);
}

export function formatMonthLabel(monthKey: string): string {
  const [y, m] = monthKey.split('-').map(Number);
  const d = new Date(y, m - 1, 1);
  return d.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });
}

export function kpiPercent(task: EmployeeTask): number {
  if (!task.kpiTarget) return 0;
  return Math.min(100, Math.round((task.kpiCurrent / task.kpiTarget) * 100));
}

export function computeRating(
  percent: number,
  status: TaskStatus,
): PerformanceRating {
  if (percent >= KPI_POSITIVE_THRESHOLD || (percent >= 60 && status === 'completado')) {
    return 'positive';
  }
  if (percent < KPI_NEGATIVE_THRESHOLD) return 'negative';
  return 'regular';
}

export function pickMotivationMessage(rating: PerformanceRating): string {
  const pool =
    rating === 'positive'
      ? POSITIVE_MESSAGES
      : rating === 'negative'
        ? NEGATIVE_MESSAGES
        : REGULAR_MESSAGES;
  return pool[Math.floor(Math.random() * pool.length)];
}

export function getStreakAlertMessage(): string {
  return STREAK_ALERT_MESSAGE;
}

function assignmentStats(
  employeeId: string,
  monthKey: string,
  assignments: TaskAssignment[],
) {
  const inMonth = assignments.filter(
    (a) => a.employeeId === employeeId && a.createdAt.slice(0, 7) === monthKey,
  );
  return {
    accepted: inMonth.filter((a) => a.status === 'accepted').length,
    rejected: inMonth.filter((a) => a.status === 'rejected').length,
  };
}

export function buildMonthlyRecord(
  task: EmployeeTask,
  monthKey: string,
  assignments: TaskAssignment[],
  closedBy: 'auto' | 'manager',
): MonthlyPerformanceRecord {
  const percent = kpiPercent(task);
  const rating = computeRating(percent, task.status);
  const stats = assignmentStats(task.employeeId, monthKey, assignments);

  return {
    id: `${task.employeeId}-${monthKey}`,
    employeeId: task.employeeId,
    employeeName: task.employeeName,
    monthKey,
    monthLabel: formatMonthLabel(monthKey),
    kpiPercent: percent,
    rating,
    objective: task.objective,
    currentWork: task.currentWork,
    status: task.status,
    message: pickMotivationMessage(rating),
    assignmentsAccepted: stats.accepted,
    assignmentsRejected: stats.rejected,
    closedAt: new Date().toISOString(),
    closedBy,
  };
}

export function closeMonthForTasks(
  store: PerformanceHistoryStore,
  tasks: EmployeeTask[],
  monthKey: string,
  assignments: TaskAssignment[],
  closedBy: 'auto' | 'manager',
): PerformanceHistoryStore {
  const existing = new Set(store.records.map((r) => r.id));
  const newRecords = [...store.records];

  for (const task of tasks) {
    const record = buildMonthlyRecord(task, monthKey, assignments, closedBy);
    if (existing.has(record.id)) continue;
    newRecords.push(record);
    existing.add(record.id);
  }

  return {
    records: newRecords,
    lastAutoCloseMonthKey:
      closedBy === 'auto' ? monthKey : store.lastAutoCloseMonthKey,
  };
}

/** Al cambiar de mes, guarda automáticamente el mes anterior. */
export function ensurePreviousMonthClosed(
  store: PerformanceHistoryStore,
  tasks: EmployeeTask[],
  assignments: TaskAssignment[],
): PerformanceHistoryStore {
  const prevKey = getPreviousMonthKey();
  const currentKey = getMonthKey();
  if (store.lastAutoCloseMonthKey === currentKey) return store;

  const hasPrev = tasks.every((t) =>
    store.records.some((r) => r.id === `${t.employeeId}-${prevKey}`),
  );
  if (hasPrev) {
    return { ...store, lastAutoCloseMonthKey: currentKey };
  }

  const updated = closeMonthForTasks(store, tasks, prevKey, assignments, 'auto');
  return { ...updated, lastAutoCloseMonthKey: currentKey };
}

export function listMonthKeys(store: PerformanceHistoryStore): string[] {
  const keys = new Set(store.records.map((r) => r.monthKey));
  keys.add(getMonthKey());
  return [...keys].sort((a, b) => b.localeCompare(a));
}

export function recordsForMonth(
  store: PerformanceHistoryStore,
  monthKey: string,
): MonthlyPerformanceRecord[] {
  return store.records
    .filter((r) => r.monthKey === monthKey)
    .sort((a, b) => a.employeeName.localeCompare(b.employeeName));
}

export function recordsForEmployee(
  store: PerformanceHistoryStore,
  employeeId: string,
): MonthlyPerformanceRecord[] {
  return store.records
    .filter((r) => r.employeeId === employeeId)
    .sort((a, b) => b.monthKey.localeCompare(a.monthKey));
}

export function consecutiveNegativeMonths(
  store: PerformanceHistoryStore,
  employeeId: string,
): number {
  const sorted = recordsForEmployee(store, employeeId);
  let streak = 0;
  for (const r of sorted) {
    if (r.rating === 'negative') streak++;
    else break;
  }
  return streak;
}

export function shouldAlertNegativeStreak(
  store: PerformanceHistoryStore,
  employeeId: string,
): boolean {
  return (
    consecutiveNegativeMonths(store, employeeId) >= NEGATIVE_STREAK_ALERT_MONTHS
  );
}

export function projectedCurrentMonth(
  task: EmployeeTask,
  assignments: TaskAssignment[],
): MonthlyPerformanceRecord {
  const monthKey = getMonthKey();
  return {
    ...buildMonthlyRecord(task, monthKey, assignments, 'auto'),
    monthLabel: `${formatMonthLabel(monthKey)} (en curso)`,
    closedAt: '',
    closedBy: 'auto',
  };
}

/** Guarda cierre de mes con mensajes editados por el gerente. */
export function applyMonthClose(
  store: PerformanceHistoryStore,
  records: MonthlyPerformanceRecord[],
): PerformanceHistoryStore {
  const byId = new Map(store.records.map((r) => [r.id, r]));
  for (const record of records) {
    byId.set(record.id, {
      ...record,
      closedAt: record.closedAt || new Date().toISOString(),
      closedBy: 'manager',
    });
  }
  return {
    records: [...byId.values()],
    lastAutoCloseMonthKey: getMonthKey(),
  };
}
