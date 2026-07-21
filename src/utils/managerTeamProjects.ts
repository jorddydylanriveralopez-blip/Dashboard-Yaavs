import { isActiveProject } from './activeItems';
import { getProjectTimelineInfo } from './projectTimeline';
import { sortProjectsByUrgency } from './projectLink';
import type { CreativeProject, ProjectStatus } from '../types';

const FINISHING_STATUSES: ProjectStatus[] = [
  'revision_interna',
  'revision_externa',
  'aprobado',
  'en_produccion',
];

export interface ManagerTeamProjectBuckets {
  dueSoon: CreativeProject[];
  overdue: CreativeProject[];
  active: CreativeProject[];
  finishing: CreativeProject[];
  counts: {
    dueSoon: number;
    overdue: number;
    active: number;
    finishing: number;
  };
}

export function buildManagerTeamProjectBuckets(
  projects: CreativeProject[],
): ManagerTeamProjectBuckets {
  const active = sortProjectsByUrgency(projects.filter(isActiveProject));
  const dueSoon: CreativeProject[] = [];
  const overdue: CreativeProject[] = [];
  const finishing: CreativeProject[] = [];

  for (const p of active) {
    const timeline = getProjectTimelineInfo(p);
    if (timeline.tone === 'overdue') overdue.push(p);
    else if (timeline.tone === 'urgent' || timeline.tone === 'soon') dueSoon.push(p);
    if (FINISHING_STATUSES.includes(p.status)) finishing.push(p);
  }

  return {
    dueSoon,
    overdue,
    active,
    finishing: sortProjectsByUrgency(finishing),
    counts: {
      dueSoon: dueSoon.length,
      overdue: overdue.length,
      active: active.length,
      finishing: finishing.length,
    },
  };
}
