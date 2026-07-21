import { DEFAULT_WORKLOAD_MAX } from '../constants';
import { countsTowardWorkload } from './activeItems';
import { collaboratorForEmployeeId, resolveProjectAssignee } from './collaboratorMap';
import { projectIncludesCollaborator } from './projectCollaborators';
import type {
  CreativeProject,
  TaskAssignment,
  User,
  WorkloadBreakdown,
  WorkloadCheckResult,
  WorkloadLimitsStore,
} from '../types';

const LEGACY_DEFAULT_WORKLOAD_MAX = 10;

export const EMPTY_WORKLOAD_LIMITS: WorkloadLimitsStore = {
  defaultMax: DEFAULT_WORKLOAD_MAX,
  byEmployee: {},
};

function migrateLegacyMax(max: number): number {
  return max === LEGACY_DEFAULT_WORKLOAD_MAX ? DEFAULT_WORKLOAD_MAX : max;
}

export function normalizeWorkloadLimits(raw: unknown): WorkloadLimitsStore {
  if (!raw || typeof raw !== 'object') return { ...EMPTY_WORKLOAD_LIMITS };
  const o = raw as Partial<WorkloadLimitsStore>;
  const defaultMax = migrateLegacyMax(
    typeof o.defaultMax === 'number' && o.defaultMax >= 1
      ? Math.round(o.defaultMax)
      : DEFAULT_WORKLOAD_MAX,
  );
  const byEmployee: Record<string, number> = {};
  if (o.byEmployee && typeof o.byEmployee === 'object') {
    for (const [id, max] of Object.entries(o.byEmployee)) {
      if (typeof max === 'number' && max >= 1) {
        byEmployee[id] = migrateLegacyMax(Math.round(max));
      }
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
  _assignments: TaskAssignment[],
  activeUsers: User[],
  options?: { excludeProjectId?: string },
): WorkloadBreakdown {
  const projectsCount = projects.filter((p) => {
    if (!countsTowardWorkload(p)) return false;
    if (p.id === options?.excludeProjectId) return false;
    const slug = collaboratorForEmployeeId(employeeId);
    if (slug && projectIncludesCollaborator(p, slug)) return true;
    return resolveProjectAssignee(p, activeUsers) === employeeId;
  }).length;

  return {
    projects: projectsCount,
    // Las indicaciones pendientes aún no son trabajo activo.
    pendingAssignments: 0,
    total: projectsCount,
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
