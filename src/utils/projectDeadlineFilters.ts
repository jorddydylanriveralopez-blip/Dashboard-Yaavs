import { getDeadlineInfo } from './deadline';
import { getHoursPaceInfo } from './projectHours';
import type { CreativeProject } from '../types';

export type ProjectDeadlineFilter =
  | 'all'
  | 'por_entregar'
  | 'atrasados'
  | 'no_terminados_a_tiempo';

export const DEADLINE_FILTERS: {
  id: ProjectDeadlineFilter;
  label: string;
  tone: 'danger' | 'warn' | 'default';
}[] = [
  { id: 'por_entregar', label: 'Por entregar', tone: 'warn' },
  { id: 'atrasados', label: 'Atrasados', tone: 'danger' },
  { id: 'no_terminados_a_tiempo', label: 'No terminados a tiempo', tone: 'danger' },
];

export function projectMatchesDeadlineFilter(
  project: CreativeProject,
  filter: ProjectDeadlineFilter,
): boolean {
  if (filter === 'all') return true;

  const deadline = getDeadlineInfo(project.commitmentDate, 'en_progreso');
  const pace = getHoursPaceInfo(project);

  switch (filter) {
    case 'por_entregar':
      return deadline.tone === 'soon' || deadline.tone === 'urgent';
    case 'atrasados':
      return deadline.tone === 'overdue';
    case 'no_terminados_a_tiempo':
      return (
        deadline.tone === 'overdue' ||
        pace.level === 'danger' ||
        pace.level === 'exceeded' ||
        (pace.level === 'warning' && deadline.daysLeft <= 3)
      );
    default:
      return true;
  }
}

export function countByDeadlineFilter(
  projects: CreativeProject[],
): Record<ProjectDeadlineFilter, number> {
  const counts: Record<ProjectDeadlineFilter, number> = {
    all: projects.length,
    por_entregar: 0,
    atrasados: 0,
    no_terminados_a_tiempo: 0,
  };

  for (const p of projects) {
    for (const { id } of DEADLINE_FILTERS) {
      if (projectMatchesDeadlineFilter(p, id)) counts[id] += 1;
    }
  }

  return counts;
}
