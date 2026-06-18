import { getDeadlineInfo } from './deadline';
import type { CreativeProject, EmployeeTask } from '../types';

/** Proyecto creativo vinculado a la tarea del tablero (por id o por nombre). */
export function findProjectForTask(
  task: EmployeeTask,
  projects: CreativeProject[],
): CreativeProject | undefined {
  if (task.linkedProjectId) {
    const byId = projects.find((p) => p.id === task.linkedProjectId);
    if (byId) return byId;
  }
  const title = task.currentWork.trim().toLowerCase();
  if (!title) return undefined;
  return projects.find((p) => {
    const name = p.projectName.trim().toLowerCase();
    return name && (title === name || title.includes(name) || name.includes(title));
  });
}

export function taskDuplicatesProject(
  task: EmployeeTask | undefined,
  projects: CreativeProject[],
): boolean {
  if (!task) return false;
  return findProjectForTask(task, projects) !== undefined;
}

/** Más retraso / más urgente primero. */
export function sortProjectsByUrgency(list: CreativeProject[]): CreativeProject[] {
  const toneRank: Record<string, number> = {
    overdue: 0,
    urgent: 1,
    soon: 2,
    ok: 3,
    done: 4,
  };
  return [...list].sort((a, b) => {
    const da = getDeadlineInfo(a.commitmentDate, 'en_progreso');
    const db = getDeadlineInfo(b.commitmentDate, 'en_progreso');
    const ra = toneRank[da.tone] ?? 3;
    const rb = toneRank[db.tone] ?? 3;
    if (ra !== rb) return ra - rb;
    return da.daysLeft - db.daysLeft;
  });
}

export function countOverdueProjects(projects: CreativeProject[]): number {
  return projects.filter(
    (p) => getDeadlineInfo(p.commitmentDate, 'en_progreso').tone === 'overdue',
  ).length;
}
