import { COLLABORATORS } from '../data/projectOptions';
import { sortProjectsByUrgency } from './projectLink';
import type { Collaborator, CreativeProject } from '../types';

export interface ProjectListGroup {
  id: string;
  title: string;
  note?: string;
  projects: CreativeProject[];
}

/** Agrupa proyectos para la vista Proyectos (empleado: solo los suyos; gerente: por colaborador). */
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
            ? 'Solo el gerente los ve aquí hasta asignarlos a una persona.'
            : undefined,
        projects: sortProjectsByUrgency(projects),
      });
    }
    return groups;
  }

  if (myCollaborator) {
    const mine = list.filter((p) => p.collaborator === myCollaborator);
    if (mine.length > 0) {
      return [
        {
          id: 'mine',
          title: 'Mis proyectos',
          note: 'Solo ves lo que el gerente te asignó a ti.',
          projects: sortProjectsByUrgency(mine),
        },
      ];
    }
  }

  if (list.length > 0) {
    return [
      {
        id: 'mine',
        title: 'Mis proyectos',
        note: 'Solo ves lo que el gerente te asignó a ti.',
        projects: sortProjectsByUrgency(list),
      },
    ];
  }

  return [];
}
