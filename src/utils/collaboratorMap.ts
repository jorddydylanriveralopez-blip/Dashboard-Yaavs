import type { Collaborator, User } from '../types';

const BY_USERNAME: Record<string, Collaborator> = {
  andrea: 'andrea',
  roberto: 'roberto',
  jorddy: 'jorddy',
  andres: 'andres',
  jesus: 'jesus',
  carlos: 'carlos',
};

export function collaboratorForUser(user: User | null): Collaborator | null {
  if (!user) return null;
  return BY_USERNAME[user.username.toLowerCase()] ?? null;
}

export function projectVisibleToUser(
  collaborator: Collaborator,
  user: User | null,
  canEditAll: boolean,
): boolean {
  if (canEditAll) return true;
  const mine = collaboratorForUser(user);
  if (!mine) return collaborator === 'todos';
  return collaborator === 'todos' || collaborator === mine;
}

/** Puede quitar del listado un proyecto ya marcado como terminado. */
export function canDeleteFinishedProject(
  collaborator: Collaborator,
  user: User | null,
  canEditAll: boolean,
): boolean {
  if (canEditAll) return true;
  return projectVisibleToUser(collaborator, user, false);
}

/** Colaborador asignado (o equipo en «todos») puede fijar la fecha de compromiso una sola vez. */
export function canEmployeeSetCommitmentDate(
  project: { collaborator: Collaborator; commitmentDateLocked?: boolean },
  user: User | null,
  canEditAll: boolean,
): boolean {
  if (canEditAll || !user || user.role === 'admin') return false;
  if (project.commitmentDateLocked) return false;
  if (!projectVisibleToUser(project.collaborator, user, false)) return false;
  if (project.collaborator === 'todos') return user.role === 'empleado';
  const mine = collaboratorForUser(user);
  return mine === project.collaborator;
}

/** Colaborador asignado puede cerrar el proyecto con prueba fotográfica. */
export function canEmployeeCompleteProject(
  project: { collaborator: Collaborator; status: string },
  user: User | null,
  canEditAll: boolean,
): boolean {
  if (canEditAll || !user || user.role === 'admin') return false;
  if (project.status === 'terminado') return false;
  if (!projectVisibleToUser(project.collaborator, user, false)) return false;
  if (project.collaborator === 'todos') return user.role === 'empleado';
  const mine = collaboratorForUser(user);
  return mine === project.collaborator;
}
