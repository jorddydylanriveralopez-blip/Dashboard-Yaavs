import { isActiveProject, isCompletedProject } from './activeItems';
import { collaboratorForEmployeeId, resolveProjectAssignee } from './collaboratorMap';
import { projectIncludesCollaborator } from './projectCollaborators';
import { getDeadlineInfo } from './deadline';
import type { CreativeProject, KpiObjectiveAssignment, TaskAssignment, User } from '../types';

export interface EmployeeWorkStats {
  /** Proyectos activos asignados a ti. */
  active: number;
  /** Proyectos ya entregados / concluidos. */
  completed: number;
  /** Con fecha urgente o vencida. */
  urgent: number;
  /** Activos sin entregar (foto de prueba). */
  notDelivered: number;
  /** Vencen en los próximos días. */
  dueSoon: number;
  /** Indicaciones del gerente por aceptar. */
  pendingAssignments: number;
}

export function projectsAssignedToEmployee(
  projects: CreativeProject[],
  employeeId: string,
  activeUsers: User[],
): CreativeProject[] {
  const slug = collaboratorForEmployeeId(employeeId);
  return projects.filter((p) => {
    if (slug && projectIncludesCollaborator(p, slug)) return true;
    const assignee = resolveProjectAssignee(p, activeUsers);
    return assignee === employeeId;
  });
}

export function computeEmployeeWorkStats(input: {
  employeeId: string;
  activeUsers: User[];
  allProjects: CreativeProject[];
  completedProjects: CreativeProject[];
  pendingAssignments: TaskAssignment[];
}): EmployeeWorkStats {
  const { employeeId, activeUsers, allProjects, completedProjects, pendingAssignments } = input;

  const mineActive = projectsAssignedToEmployee(allProjects, employeeId, activeUsers).filter(
    isActiveProject,
  );
  const mineCompleted = projectsAssignedToEmployee(
    completedProjects,
    employeeId,
    activeUsers,
  ).filter(isCompletedProject);

  let urgent = 0;
  let dueSoon = 0;
  for (const p of mineActive) {
    const tone = getDeadlineInfo(p.commitmentDate, 'en_progreso').tone;
    if (tone === 'overdue' || tone === 'urgent') urgent += 1;
    else if (tone === 'soon') dueSoon += 1;
  }

  return {
    active: mineActive.length,
    completed: mineCompleted.length,
    urgent,
    notDelivered: mineActive.length,
    dueSoon,
    pendingAssignments: pendingAssignments.length,
  };
}

export function pendingKpiForEmployee(
  objectives: KpiObjectiveAssignment[],
  employeeId: string,
): KpiObjectiveAssignment[] {
  return objectives.filter((k) => k.employeeId === employeeId && k.status === 'pending');
}
