import { COLLABORATORS } from '../data/projectOptions';
import { sortProjectsByUrgency } from './projectLink';
import type { Collaborator, CreativeProject } from '../types';

export interface ProjectListGroup {
  id: string;
  title: string;
  note?: string;
  projects: CreativeProject[];
}

/** Agrupa proyectos para la vista Proyectos (empleado: míos vs TODOS; gerente: por colaborador). */
export function groupProjectsForBoard(
  list: CreativeProject[],
  canEditAll: boolean,
  myCollaborator: Collaborator | null,
): ProjectListGroup[] {
  if (canEditAll) {
    const groups: ProjectListGroup[] = [];
    for (const c of COLLABORATORS) {
      const projects = list.filter((p) => p.collaborator === c.value);
      if (projects.length === 0) continue;
      groups.push({
        id: c.value,
        title: c.value === 'todos' ? 'Todo el equipo (TODOS)' : c.label,
        note:
          c.value === 'todos'
            ? 'Asignados a todo el equipo creativo.'
            : undefined,
        projects: sortProjectsByUrgency(projects),
      });
    }
    return groups;
  }

  const groups: ProjectListGroup[] = [];
  if (myCollaborator) {
    const mine = list.filter((p) => p.collaborator === myCollaborator);
    if (mine.length > 0) {
      groups.push({
        id: 'mine',
        title: 'Mis proyectos',
        projects: sortProjectsByUrgency(mine),
      });
    }
  }
  const team = list.filter((p) => p.collaborator === 'todos');
  if (team.length > 0) {
    groups.push({
      id: 'todos',
      title: 'Todo el equipo (TODOS)',
      note: 'Los ve cualquier miembro del equipo; concluye solo si te corresponde.',
      projects: sortProjectsByUrgency(team),
    });
  }
  return groups;
}
