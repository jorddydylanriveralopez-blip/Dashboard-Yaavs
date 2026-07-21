import type { CreativeProject } from '../types';
import { isActiveProject } from './activeItems';
import { countOverdueProjects } from './projectLink';
import { isEarlyDelivery } from './projectHours';
import { projectDueDate } from './projectTimeline';
import { formatMonthLabel, getMonthKey } from './performanceHistory';

export function projectFinishedInMonth(
  project: CreativeProject,
  monthKey: string,
): boolean {
  const finished = project.finishedDate ?? project.completedAt?.slice(0, 10);
  return Boolean(finished?.startsWith(monthKey));
}

export function projectDeliveredOnTime(project: CreativeProject): boolean {
  const finished = project.finishedDate ?? project.completedAt?.slice(0, 10);
  if (!finished) return false;
  const due = projectDueDate(project) ?? project.commitmentDate;
  return finished <= due || isEarlyDelivery(project);
}

export function projectsDeliveredInMonth(
  projects: CreativeProject[],
  monthKey: string,
): CreativeProject[] {
  return projects.filter(
    (p) => p.status === 'terminado' && projectFinishedInMonth(p, monthKey),
  );
}

export interface PanoramaDeliverySummary {
  /** % de entregas del mes que fueron a tiempo. */
  avgDeliveryPercent: number;
  /** Días del mes con al menos una entrega registrada. */
  daysWithDeliveries: number;
  overdueProjects: number;
  activeProjects: number;
  deliveredInMonth: number;
  onTimeInMonth: number;
}

export interface DeliveryMonthPoint {
  monthKey: string;
  monthLabel: string;
  shortLabel: string;
  delivered: number;
  onTime: number;
  late: number;
  onTimePercent: number | null;
}

function shortMonthLabel(monthKey: string): string {
  const [y, m] = monthKey.split('-').map(Number);
  const d = new Date(y, m - 1, 1);
  const month = d.toLocaleDateString('es-MX', { month: 'short' });
  return `${month} ${String(y).slice(-2)}`;
}

export function finishedDayOfMonth(project: CreativeProject): number | null {
  const finished = project.finishedDate ?? project.completedAt?.slice(0, 10);
  if (!finished) return null;
  return Number(finished.slice(8, 10));
}

export function projectFinishedInMonthDayRange(
  project: CreativeProject,
  monthKey: string,
  dayFrom: number,
  dayTo: number,
): boolean {
  if (!projectFinishedInMonth(project, monthKey)) return false;
  const day = finishedDayOfMonth(project);
  if (day == null || Number.isNaN(day)) return false;
  const from = Math.min(dayFrom, dayTo);
  const to = Math.max(dayFrom, dayTo);
  return day >= from && day <= to;
}

export function projectsDeliveredInMonthDayRange(
  projects: CreativeProject[],
  monthKey: string,
  dayFrom: number,
  dayTo: number,
): CreativeProject[] {
  return projects.filter(
    (p) =>
      p.status === 'terminado' &&
      projectFinishedInMonthDayRange(p, monthKey, dayFrom, dayTo),
  );
}

export function listMonthKeysBetween(from: string, to: string): string[] {
  const [y1, m1] = from.split('-').map(Number);
  const [y2, m2] = to.split('-').map(Number);
  const start = new Date(y1, m1 - 1, 1);
  const end = new Date(y2, m2 - 1, 1);
  if (start > end) return listMonthKeysBetween(to, from);
  const keys: string[] = [];
  const cur = new Date(start);
  while (cur <= end) {
    keys.push(getMonthKey(cur));
    cur.setMonth(cur.getMonth() + 1);
  }
  return keys;
}

export function collectDeliveryMonthKeys(
  projects: CreativeProject[],
  extraKeys: string[] = [],
): string[] {
  const keys = new Set<string>(extraKeys);
  keys.add(getMonthKey());
  for (const p of projects) {
    if (p.status !== 'terminado') continue;
    const finished = p.finishedDate ?? p.completedAt?.slice(0, 10);
    if (finished) keys.add(finished.slice(0, 7));
  }
  return [...keys].sort((a, b) => a.localeCompare(b));
}

export function buildDeliveryMonthlyTrend(
  projects: CreativeProject[],
  monthKeys: string[],
  dayFrom = 1,
  dayTo = 31,
): DeliveryMonthPoint[] {
  return monthKeys.map((monthKey) => {
    const delivered = projectsDeliveredInMonthDayRange(
      projects,
      monthKey,
      dayFrom,
      dayTo,
    );
    const onTime = delivered.filter(projectDeliveredOnTime).length;
    const late = delivered.length - onTime;
    return {
      monthKey,
      monthLabel: formatMonthLabel(monthKey),
      shortLabel: shortMonthLabel(monthKey),
      delivered: delivered.length,
      onTime,
      late,
      onTimePercent:
        delivered.length === 0 ? null : Math.round((onTime / delivered.length) * 100),
    };
  });
}

export function buildPanoramaDeliverySummary(
  projects: CreativeProject[],
  monthKey: string,
): PanoramaDeliverySummary {
  const delivered = projectsDeliveredInMonth(projects, monthKey);
  const onTime = delivered.filter(projectDeliveredOnTime).length;
  const deliveryDays = new Set(
    delivered
      .map((p) => p.finishedDate ?? p.completedAt?.slice(0, 10))
      .filter((d): d is string => Boolean(d)),
  );
  const active = projects.filter(isActiveProject);

  return {
    avgDeliveryPercent:
      delivered.length === 0 ? 0 : Math.round((onTime / delivered.length) * 100),
    daysWithDeliveries: deliveryDays.size,
    overdueProjects: countOverdueProjects(active),
    activeProjects: active.length,
    deliveredInMonth: delivered.length,
    onTimeInMonth: onTime,
  };
}
