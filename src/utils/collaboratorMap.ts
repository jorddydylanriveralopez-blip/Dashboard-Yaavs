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
  'ana',
];

export function collaboratorForUser(user: User | null): Collaborator | null {
  if (!user) return null;
  const un = user.username.toLowerCase();
  if (USERNAME_TO_COLLABORATOR[un]) return USERNAME_TO_COLLABORATOR[un];
  if (NAMED_COLLABORATORS.includes(un as Collaborator)) return un as Collaborator;
  return null;
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
  project: Pick<CreativeProject, 'collaborator' | 'assignedEmployeeId'>,
  activeUsers: User[],
): string | undefined {
  if (project.assignedEmployeeId) return project.assignedEmployeeId;
  return employeeIdForCollaboratorSlug(project.collaborator, activeUsers);
}

/** Colaboradores solo ven proyectos asignados a su persona; gerente ve todo. */
export function projectVisibleToUser(
  project: Pick<CreativeProject, 'collaborator' | 'assignedEmployeeId'>,
  user: User | null,
  canEditAll: boolean,
  activeUsers: User[],
): boolean {
  if (canEditAll) return true;
  if (!user?.employeeId) return false;
  const assignee = resolveProjectAssignee(project, activeUsers);
  if (!assignee) return false;
  return assignee === user.employeeId;
}

export function patchForCollaboratorChange(
  collaborator: Collaborator,
  activeUsers: User[],
): Pick<CreativeProject, 'collaborator' | 'assignedEmployeeId'> {
  return {
    collaborator,
    assignedEmployeeId: employeeIdForCollaboratorSlug(collaborator, activeUsers),
  };
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
