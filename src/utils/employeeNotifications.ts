import { EMPLOYEE_NOTIFICATIONS_SEEN_KEY } from '../constants';
import { formatActivityTime } from './activityFeed';
import { getDeadlineInfo } from './deadline';
import { isActiveProject } from './activeItems';
import { projectsAssignedToEmployee } from './employeeWorkStats';
import {
  consecutiveNegativeMonths,
  getMonthKey,
  shouldAlertNegativeStreak,
} from './performanceHistory';
import type {
  ActivityEvent,
  CreativeProject,
  KpiObjectiveAssignment,
  PerformanceHistoryStore,
  TaskAssignment,
  User,
} from '../types';

export type EmployeeNotificationKind =
  | 'assignment'
  | 'kpi_objective'
  | 'activity'
  | 'project'
  | 'overdue'
  | 'due_soon'
  | 'performance'
  | 'improvement'
  | 'manager_note';

export type NotificationTarget =
  | 'home'
  | 'assignments'
  | 'projects'
  | 'projects-completed'
  | 'team-kpis'
  | 'team'
  | 'calendar'
  | 'attendance';

export interface EmployeeNotification {
  id: string;
  kind: EmployeeNotificationKind;
  target: NotificationTarget;
  title: string;
  detail: string;
  at: string;
  unread: boolean;
}

export function loadNotificationsSeenAt(): string | null {
  try {
    return localStorage.getItem(EMPLOYEE_NOTIFICATIONS_SEEN_KEY);
  } catch {
    return null;
  }
}

export function markNotificationsSeen(): void {
  localStorage.setItem(EMPLOYEE_NOTIFICATIONS_SEEN_KEY, new Date().toISOString());
}

function isUnread(at: string, seenAt: string | null): boolean {
  if (!seenAt) return true;
  return new Date(at).getTime() > new Date(seenAt).getTime();
}

function tipTarget(tip: string): NotificationTarget {
  const lower = tip.toLowerCase();
  if (lower.includes('horas') || lower.includes('cronómetro')) return 'projects';
  if (lower.includes('asistencia') || lower.includes('puntualidad')) return 'attendance';
  if (lower.includes('kpi') || lower.includes('avance')) return 'team-kpis';
  return 'projects';
}

export function buildEmployeeNotifications(input: {
  userName: string;
  employeeId: string;
  activeUsers: User[];
  allProjects: CreativeProject[];
  pendingAssignments: TaskAssignment[];
  pendingKpiObjectives: KpiObjectiveAssignment[];
  activityFeed: ActivityEvent[];
  performanceHistory: PerformanceHistoryStore;
  improvementTips?: string[];
  managerNote?: string;
  managerNoteUpdatedAt?: string;
  seenAt?: string | null;
  limit?: number;
}): EmployeeNotification[] {
  const seenAt = input.seenAt ?? loadNotificationsSeenAt();
  const limit = input.limit ?? 24;
  const items: EmployeeNotification[] = [];
  const pendingIds = new Set(input.pendingAssignments.map((a) => a.id));

  for (const a of input.pendingAssignments) {
    items.push({
      id: `asg-${a.id}`,
      kind: 'assignment',
      target: 'assignments',
      title: 'Nueva indicación del gerente',
      detail: `${a.assignedByName}: ${a.title}`,
      at: a.createdAt,
      unread: isUnread(a.createdAt, seenAt),
    });
  }

  for (const k of input.pendingKpiObjectives) {
    items.push({
      id: `kpi-${k.id}`,
      kind: 'kpi_objective',
      target: 'team-kpis',
      title: 'Objetivo KPI por aceptar',
      detail: `${k.assignedByName} te asignó una meta para ${k.monthLabel ?? 'el mes'}`,
      at: k.createdAt,
      unread: isUnread(k.createdAt, seenAt),
    });
  }

  if (shouldAlertNegativeStreak(input.performanceHistory, input.employeeId)) {
    const months = consecutiveNegativeMonths(input.performanceHistory, input.employeeId);
    items.push({
      id: `perf-streak-${input.employeeId}`,
      kind: 'performance',
      target: 'team-kpis',
      title: 'KPI por debajo de la meta',
      detail: `Llevas ${months} meses con rendimiento bajo. Revisa tus KPIs y habla con tu gerente.`,
      at: new Date().toISOString(),
      unread: isUnread(new Date().toISOString(), seenAt),
    });
  }

  const managerNote = input.managerNote?.trim();
  if (managerNote) {
    items.push({
      id: `mgr-note-${getMonthKey()}`,
      kind: 'manager_note',
      target: 'team-kpis',
      title: 'Observación del gerente',
      detail: managerNote.length > 140 ? `${managerNote.slice(0, 137)}…` : managerNote,
      at: input.managerNoteUpdatedAt ?? new Date().toISOString(),
      unread: isUnread(input.managerNoteUpdatedAt ?? new Date().toISOString(), seenAt),
    });
  }

  const mineActive = projectsAssignedToEmployee(
    input.allProjects,
    input.employeeId,
    input.activeUsers,
  ).filter(isActiveProject);

  for (const p of mineActive) {
    const deadline = getDeadlineInfo(p.commitmentDate, 'en_progreso');
    if (deadline.tone !== 'overdue') continue;
    items.push({
      id: `od-${p.id}`,
      kind: 'overdue',
      target: 'projects',
      title: 'Proyecto con retraso',
      detail: `«${p.projectName.trim() || 'Sin nombre'}» — ${deadline.label}`,
      at: `${p.commitmentDate}T12:00:00`,
      unread: isUnread(`${p.commitmentDate}T12:00:00`, seenAt),
    });
  }

  for (const p of mineActive) {
    const deadline = getDeadlineInfo(p.commitmentDate, 'en_progreso');
    if (deadline.tone !== 'urgent' && deadline.tone !== 'soon') continue;
    items.push({
      id: `soon-${p.id}`,
      kind: 'due_soon',
      target: 'projects',
      title: 'Proyecto por acabar pronto',
      detail: `«${p.projectName.trim() || 'Sin nombre'}» — ${deadline.label}`,
      at: `${p.commitmentDate}T12:00:00`,
      unread: isUnread(`${p.commitmentDate}T12:00:00`, seenAt),
    });
  }

  for (const tip of input.improvementTips ?? []) {
    items.push({
      id: `tip-${tip.slice(0, 24)}`,
      kind: 'improvement',
      target: tipTarget(tip),
      title: 'Área de mejora',
      detail: tip,
      at: new Date().toISOString(),
      unread: isUnread(new Date().toISOString(), seenAt),
    });
  }

  const name = input.userName.trim();
  for (const e of input.activityFeed) {
    if (e.kind === 'assignment_sent' && pendingIds.size > 0) continue;
    const relevant =
      e.kind === 'assignment_sent' ||
      (name && e.message.includes(name)) ||
      e.actorName === name;
    if (!relevant) continue;
    items.push({
      id: `act-${e.id}`,
      kind: e.kind === 'assignment_sent' ? 'assignment' : 'activity',
      target: e.kind === 'assignment_sent' ? 'assignments' : 'home',
      title: e.kind === 'assignment_sent' ? 'Te enviaron una indicación' : 'Actividad del equipo',
      detail: e.message,
      at: e.at,
      unread: isUnread(e.at, seenAt),
    });
  }

  const unique = new Map<string, EmployeeNotification>();
  for (const item of items) {
    if (!unique.has(item.id)) unique.set(item.id, item);
  }

  return [...unique.values()]
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, limit);
}

export function countUnreadNotifications(notifications: EmployeeNotification[]): number {
  return notifications.filter((n) => n.unread).length;
}

export function formatNotificationTime(iso: string): string {
  return formatActivityTime(iso);
}

export function notificationKindLabel(kind: EmployeeNotificationKind): string {
  switch (kind) {
    case 'assignment':
      return 'Indicación';
    case 'kpi_objective':
      return 'KPI';
    case 'overdue':
      return 'Retraso';
    case 'due_soon':
      return 'Por acabar';
    case 'performance':
      return 'Rendimiento';
    case 'improvement':
      return 'Mejora';
    case 'manager_note':
      return 'Gerente';
    case 'project':
      return 'Proyecto';
    default:
      return 'Aviso';
  }
}
