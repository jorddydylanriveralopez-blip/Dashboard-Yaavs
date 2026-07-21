import { getProjectCollaborators, projectIncludesCollaborator } from './projectCollaborators';
import type { Collaborator, CreativeProject, User } from '../types';

/** Usuario de login → slug de colaborador en proyectos. */
const USERNAME_TO_COLLABORATOR: Record<string, Collaborator> = {
  juancarlos: 'carlos',
};

/** Slug de colaborador → usuario de login (cuando no coinciden). */
const COLLABORATOR_USERNAMES: Partial<Record<Collaborator, string>> = {
  carlos: 'juancarlos',
};

const NAMED_COLLABORATORS: Collaborator[] = [
  'andrea',
  'roberto',
  'jorddy',
  'andres',
  'jesus',
  'carlos',
  'yared',
];

export function collaboratorForUser(user: User | null): Collaborator | null {
  if (!user) return null;
  const un = user.username.toLowerCase();
  if (USERNAME_TO_COLLABORATOR[un]) return USERNAME_TO_COLLABORATOR[un];
  if (NAMED_COLLABORATORS.includes(un as Collaborator)) return un as Collaborator;
  return null;
}

const EMPLOYEE_ID_TO_COLLABORATOR: Record<string, Collaborator> = {
  'emp-jesus': 'jesus',
  'emp-jorddy': 'jorddy',
  'emp-andres': 'andres',
  'emp-andrea': 'andrea',
  'emp-juancarlos': 'carlos',
  'emp-yared': 'yared',
  'emp-roberto': 'roberto',
};

export function collaboratorForEmployeeId(employeeId: string): Collaborator | null {
  return EMPLOYEE_ID_TO_COLLABORATOR[employeeId] ?? null;
}

export function employeeIdForCollaboratorSlug(
  collaborator: Collaborator,
  users: User[],
): string | undefined {
  if (collaborator === 'todos') return undefined;
  const username = COLLABORATOR_USERNAMES[collaborator] ?? collaborator;
  return users.find((u) => u.username.toLowerCase() === username)?.employeeId;
}

export function resolveProjectAssignee(
  project: Pick<CreativeProject, 'collaborator' | 'collaborators' | 'assignedEmployeeId'>,
  activeUsers: User[],
): string | undefined {
  if (project.assignedEmployeeId) return project.assignedEmployeeId;
  const collabs = getProjectCollaborators(project);
  if (collabs.length === 1 && !collabs.includes('todos')) {
    return employeeIdForCollaboratorSlug(collabs[0], activeUsers);
  }
  if (project.collaborator !== 'todos') {
    return employeeIdForCollaboratorSlug(project.collaborator, activeUsers);
  }
  return undefined;
}

/** Colaboradores solo ven proyectos asignados a su persona; gerente ve todo. */
export function projectVisibleToUser(
  project: Pick<
    CreativeProject,
    'collaborator' | 'collaborators' | 'assignedEmployeeId' | 'acceptanceStatus'
  >,
  user: User | null,
  canEditAll: boolean,
  activeUsers: User[],
): boolean {
  if (canEditAll) return true;
  if (!user?.employeeId) return false;
  // Rechazado: solo gerencia lo sigue viendo para reasignar.
  if (project.acceptanceStatus === 'declined') return false;
  const mySlug = collaboratorForUser(user) ?? collaboratorForEmployeeId(user.employeeId);
  if (mySlug && projectIncludesCollaborator(project, mySlug)) return true;
  const assignee = resolveProjectAssignee(project, activeUsers);
  return assignee === user.employeeId;
}

export function patchForCollaboratorChange(
  collaborator: Collaborator,
  activeUsers: User[],
): Pick<CreativeProject, 'collaborator' | 'collaborators' | 'assignedEmployeeId'> {
  if (collaborator === 'todos') {
    return { collaborator: 'todos', collaborators: ['todos'], assignedEmployeeId: undefined };
  }
  return {
    collaborator,
    collaborators: [collaborator],
    assignedEmployeeId: employeeIdForCollaboratorSlug(collaborator, activeUsers),
  };
}

/** Colaborador asignado debe aceptar el proyecto (o ya está pendiente). */
export function projectNeedsAcceptance(
  project: Pick<
    CreativeProject,
    'status' | 'acceptanceStatus' | 'collaborator' | 'collaborators' | 'assignedEmployeeId'
  >,
  user: User | null,
  canEditAll: boolean,
  activeUsers: User[],
): boolean {
  if (canEditAll || !user || project.status === 'terminado') return false;
  if (project.acceptanceStatus === 'accepted' || project.acceptanceStatus === 'declined') {
    return false;
  }
  if (!projectVisibleToUser(project, user, false, activeUsers)) return false;
  const collabs = getProjectCollaborators(project);
  // Solo proyectos con un colaborador concreto (no "todos" ni multi-asignación).
  if (collabs.length !== 1 || collabs.includes('todos')) return false;
  return project.acceptanceStatus === 'pending' || project.status === 'nuevo';
}

/** Puede quitar del listado un proyecto ya marcado como terminado. */
export function canDeleteFinishedProject(
  project: Pick<CreativeProject, 'collaborator' | 'assignedEmployeeId'>,
  user: User | null,
  canEditAll: boolean,
  activeUsers: User[],
): boolean {
  if (canEditAll) return true;
  return projectVisibleToUser(project, user, false, activeUsers);
}

/** Colaborador asignado puede fijar la fecha de compromiso una sola vez. */
export function canEmployeeSetCommitmentDate(
  project: Pick<
    CreativeProject,
    'collaborator' | 'assignedEmployeeId' | 'commitmentDateLocked'
  >,
  user: User | null,
  canEditAll: boolean,
  activeUsers: User[],
): boolean {
  if (canEditAll || !user || user.role === 'admin') return false;
  if (project.commitmentDateLocked) return false;
  return projectVisibleToUser(project, user, false, activeUsers);
}

/** Colaborador asignado puede cerrar el proyecto con prueba fotográfica. */
export function canEmployeeCompleteProject(
  project: Pick<CreativeProject, 'collaborator' | 'assignedEmployeeId' | 'status'>,
  user: User | null,
  canEditAll: boolean,
  activeUsers: User[],
): boolean {
  if (canEditAll || !user || user.role === 'admin') return false;
  if (project.status === 'terminado') return false;
  return projectVisibleToUser(project, user, false, activeUsers);
}

/** Colaborador asignado o gerente pueden registrar horas en proyectos activos. */
export function canTrackProjectHours(
  project: Pick<CreativeProject, 'collaborator' | 'assignedEmployeeId' | 'status'>,
  user: User | null,
  canEditAll: boolean,
  activeUsers: User[],
): boolean {
  if (canEditAll) return project.status !== 'terminado';
  if (!user || user.role === 'admin' || project.status === 'terminado') return false;
  return projectVisibleToUser(project, user, false, activeUsers);
}
