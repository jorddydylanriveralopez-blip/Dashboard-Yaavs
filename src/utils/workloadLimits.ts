import { DEFAULT_WORKLOAD_MAX } from '../constants';
import { isActiveProject, isPendingAssignment } from './activeItems';
import { resolveProjectAssignee } from './collaboratorMap';
import type {
  CreativeProject,
  TaskAssignment,
  User,
  WorkloadBreakdown,
  WorkloadCheckResult,
  WorkloadLimitsStore,
} from '../types';

export const EMPTY_WORKLOAD_LIMITS: WorkloadLimitsStore = {
  defaultMax: DEFAULT_WORKLOAD_MAX,
  byEmployee: {},
};

export function normalizeWorkloadLimits(raw: unknown): WorkloadLimitsStore {
  if (!raw || typeof raw !== 'object') return { ...EMPTY_WORKLOAD_LIMITS };
  const o = raw as Partial<WorkloadLimitsStore>;
  const defaultMax =
    typeof o.defaultMax === 'number' && o.defaultMax >= 1
      ? Math.round(o.defaultMax)
      : DEFAULT_WORKLOAD_MAX;
  const byEmployee: Record<string, number> = {};
  if (o.byEmployee && typeof o.byEmployee === 'object') {
    for (const [id, max] of Object.entries(o.byEmployee)) {
      if (typeof max === 'number' && max >= 1) byEmployee[id] = Math.round(max);
    }
  }
  return { defaultMax, byEmployee };
}

export function getWorkloadMax(
  employeeId: string,
  store: WorkloadLimitsStore,
): number {
  return store.byEmployee[employeeId] ?? store.defaultMax;
}

export function countEmployeeWorkload(
  employeeId: string,
  projects: CreativeProject[],
  assignments: TaskAssignment[],
  activeUsers: User[],
  options?: { excludeProjectId?: string },
): WorkloadBreakdown {
  const projectsCount = projects.filter((p) => {
    if (!isActiveProject(p)) return false;
    if (p.id === options?.excludeProjectId) return false;
    if (p.collaborator === 'todos') return false;
    return resolveProjectAssignee(p, activeUsers) === employeeId;
  }).length;

  const pendingAssignments = assignments.filter(
    (a) => a.employeeId === employeeId && isPendingAssignment(a),
  ).length;

  return {
    projects: projectsCount,
    pendingAssignments,
    total: projectsCount + pendingAssignments,
  };
}

export function buildWorkloadCheck(
  employeeId: string,
  employeeName: string,
  projects: CreativeProject[],
  assignments: TaskAssignment[],
  activeUsers: User[],
  store: WorkloadLimitsStore,
  options?: { excludeProjectId?: string; addSlots?: number },
): WorkloadCheckResult {
  const current = countEmployeeWorkload(
    employeeId,
    projects,
    assignments,
    activeUsers,
    options,
  );
  const max = getWorkloadMax(employeeId, store);
  const addSlots = options?.addSlots ?? 0;
  const projected = current.total + addSlots;
  const allowed = projected <= max;

  return {
    employeeId,
    employeeName,
    current,
    max,
    projected,
    allowed,
    saturated: current.total >= max,
  };
}

export function workloadLabel(check: WorkloadCheckResult): string {
  return `${check.current.total}/${check.max} trabajos`;
}
