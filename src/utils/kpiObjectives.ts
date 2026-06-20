import { formatMonthLabel, getMonthKey } from './performanceHistory';

export function endOfMonthDate(monthKey = getMonthKey()): string {
  const [y, m] = monthKey.split('-').map(Number);
  const last = new Date(y, m, 0);
  return last.toISOString().slice(0, 10);
}

export function currentMonthLabel(): string {
  return formatMonthLabel(getMonthKey());
}

export function hasActiveKpiObjective(
  task: { kpiObjectiveMonthKey?: string },
  monthKey = getMonthKey(),
): boolean {
  return task.kpiObjectiveMonthKey === monthKey;
}
