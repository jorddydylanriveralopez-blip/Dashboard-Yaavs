import type { CreativeProject, EmployeeTask, TaskAssignment } from '../types';

/** Proyectos visibles en el tablero (los terminados se archivan solos). */
export function isActiveProject(project: CreativeProject): boolean {
  return project.status !== 'terminado';
}

export function filterActiveProjects(projects: CreativeProject[]): CreativeProject[] {
  return projects.filter(isActiveProject);
}

export function isCompletedProject(project: CreativeProject): boolean {
  return project.status === 'terminado';
}

export function filterCompletedProjects(projects: CreativeProject[]): CreativeProject[] {
  return projects.filter(isCompletedProject);
}

/** Indicaciones que siguen pendientes de respuesta. */
export function isPendingAssignment(assignment: TaskAssignment): boolean {
  return assignment.status === 'pending';
}

export function filterPendingAssignments(assignments: TaskAssignment[]): TaskAssignment[] {
  return assignments.filter(isPendingAssignment);
}

export function clearedTaskWork(_task?: EmployeeTask): Partial<EmployeeTask> {
  return {
    currentWork: 'Sin tarea activa',
    status: 'sin_empezar',
    kpiCurrent: 0,
    notes: '',
  };
}
