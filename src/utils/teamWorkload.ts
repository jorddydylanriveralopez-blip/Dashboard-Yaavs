import { COLLABORATORS, labelFor } from '../data/projectOptions';
import { isActiveProject } from './activeItems';
import { getDeadlineInfo } from './deadline';
import { projectIncludesCollaborator } from './projectCollaborators';
import {
  countEmployeeWorkload,
  getWorkloadMax,
} from './workloadLimits';
import type { CreativeProject, TaskAssignment, User, WorkloadLimitsStore } from '../types';

export interface TeamWorkloadRow {
  id: string;
  name: string;
  activeCount: number;
  overdueCount: number;
  dueSoonCount: number;
}

export interface TeamCapacityRow {
  id: string;
  name: string;
  projects: number;
  pendingAssignments: number;
  total: number;
  max: number;
  overdueCount: number;
  dueSoonCount: number;
  saturated: boolean;
  nearlyFull: boolean;
  fillPercent: number;
}

/** Carga de proyectos activos por colaborador (gerente). */
export function buildTeamWorkload(
  projects: CreativeProject[],
  activeUsers: User[],
): TeamWorkloadRow[] {
  const active = projects.filter(isActiveProject);
  const rows = new Map<string, TeamWorkloadRow>();

  for (const c of COLLABORATORS) {
    if (c.value === 'todos') continue;
    const employeeId = activeUsers.find(
      (u) => u.username.toLowerCase() === (c.value === 'carlos' ? 'juancarlos' : c.value),
    )?.employeeId;
    if (!employeeId) continue;
    rows.set(employeeId, {
      id: employeeId,
      name: c.label,
      activeCount: 0,
      overdueCount: 0,
      dueSoonCount: 0,
    });
  }

  for (const p of active) {
    for (const c of COLLABORATORS) {
      if (c.value === 'todos') continue;
      if (!projectIncludesCollaborator(p, c.value)) continue;
      const employeeId = activeUsers.find(
        (u) => u.username.toLowerCase() === (c.value === 'carlos' ? 'juancarlos' : c.value),
      )?.employeeId;
      if (!employeeId) continue;
      const row = rows.get(employeeId);
      if (!row) continue;
      row.activeCount += 1;
      const tone = getDeadlineInfo(p.commitmentDate, 'en_progreso').tone;
      if (tone === 'overdue') row.overdueCount += 1;
      else if (tone === 'urgent' || tone === 'soon') row.dueSoonCount += 1;
    }
  }

  return Array.from(rows.values())
    .filter((r) => r.activeCount > 0)
    .sort((a, b) => b.overdueCount - a.overdueCount || b.activeCount - a.activeCount);
}

/** Carga total vs límite por colaborador (proyectos + indicaciones pendientes). */
export function buildTeamCapacity(
  projects: CreativeProject[],
  assignments: TaskAssignment[],
  activeUsers: User[],
  limits: WorkloadLimitsStore,
): TeamCapacityRow[] {
  const active = projects.filter(isActiveProject);
  const rows: TeamCapacityRow[] = [];

  for (const c of COLLABORATORS) {
    if (c.value === 'todos') continue;
    const employeeId = activeUsers.find(
      (u) => u.username.toLowerCase() === (c.value === 'carlos' ? 'juancarlos' : c.value),
    )?.employeeId;
    if (!employeeId) continue;

    const workload = countEmployeeWorkload(employeeId, projects, assignments, activeUsers);
    const max = getWorkloadMax(employeeId, limits);
    let overdueCount = 0;
    let dueSoonCount = 0;

    for (const p of active) {
      if (!projectIncludesCollaborator(p, c.value)) continue;
      const tone = getDeadlineInfo(p.commitmentDate, 'en_progreso').tone;
      if (tone === 'overdue') overdueCount += 1;
      else if (tone === 'urgent' || tone === 'soon') dueSoonCount += 1;
    }

    const fillPercent = max > 0 ? Math.min(100, Math.round((workload.total / max) * 100)) : 0;

    rows.push({
      id: employeeId,
      name: c.label,
      projects: workload.projects,
      pendingAssignments: workload.pendingAssignments,
      total: workload.total,
      max,
      overdueCount,
      dueSoonCount,
      saturated: workload.total >= max,
      nearlyFull: workload.total >= max - 1 && workload.total < max,
      fillPercent,
    });
  }

  return rows.sort(
    (a, b) =>
      Number(b.saturated) - Number(a.saturated) ||
      b.fillPercent - a.fillPercent ||
      b.total - a.total,
  );
}

export function collaboratorLabel(collaborator: CreativeProject['collaborator']): string {
  return labelFor(COLLABORATORS, collaborator);
}
