import type { Collaborator } from '../types';

/** Nombre completo por id de empleado en el tablero. */
export const TEAM_MEMBER_NAMES: Record<string, string> = {
  'emp-orlando': 'Orlando Villagómez',
  'emp-juancarlos': 'Carlos Trejo',
  'emp-andrea': 'Andrea Sánchez',
  'emp-andres': 'Andrés Gordillo',
  'emp-roberto': 'Roberto Magaña',
  'emp-jorddy': 'Dylan Rivera',
  'emp-jesus': 'Jesús Higuera',
  'emp-yared': 'Yared Pérez',
};

/** Nombre completo por slug de colaborador en proyectos. */
export const COLLABORATOR_DISPLAY_NAMES: Record<Collaborator, string> = {
  andrea: 'Andrea Sánchez',
  roberto: 'Roberto Magaña',
  jorddy: 'Dylan Rivera',
  andres: 'Andrés Gordillo',
  jesus: 'Jesús Higuera',
  carlos: 'Carlos Trejo',
  yared: 'Yared Pérez',
  todos: 'TODOS',
};

export function displayNameForEmployee(employeeId: string): string | undefined {
  return TEAM_MEMBER_NAMES[employeeId];
}

export function displayNameForCollaborator(slug: Collaborator): string {
  return COLLABORATOR_DISPLAY_NAMES[slug] ?? slug;
}
