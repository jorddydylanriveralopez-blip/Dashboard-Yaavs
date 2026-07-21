import type { Collaborator, CreativeProject, ProjectStatus } from '../types';
import { isActiveProject } from './activeItems';
import { projectIncludesCollaborator } from './projectCollaborators';
import { getProjectTimelineInfo } from './projectTimeline';
import { sortProjectsByUrgency } from './projectLink';

const FINISHING_STATUSES: ProjectStatus[] = [
  'revision_interna',
  'revision_externa',
  'aprobado',
  'en_produccion',
];

export type CollaboratorProjectBucket = 'overdue' | 'finishing' | 'dueSoon' | 'active';

export interface CollaboratorProjectBuckets {
  overdue: CreativeProject[];
  finishing: CreativeProject[];
  dueSoon: CreativeProject[];
  active: CreativeProject[];
  allActive: CreativeProject[];
}

export function projectsForCollaboratorSlug(
  allProjects: CreativeProject[],
  collaborator: Collaborator,
): CreativeProject[] {
  return allProjects.filter((p) => projectIncludesCollaborator(p, collaborator));
}

function bucketForProject(project: CreativeProject): CollaboratorProjectBucket {
  const timeline = getProjectTimelineInfo(project);
  if (timeline.tone === 'overdue') return 'overdue';
  if (FINISHING_STATUSES.includes(project.status)) return 'finishing';
  if (timeline.tone === 'soon' || timeline.tone === 'urgent') return 'dueSoon';
  return 'active';
}

export function buildCollaboratorProjectBuckets(
  allProjects: CreativeProject[],
  collaborator: Collaborator,
): CollaboratorProjectBuckets {
  const allActive = sortProjectsByUrgency(
    projectsForCollaboratorSlug(allProjects, collaborator).filter(isActiveProject),
  );
  const buckets: CollaboratorProjectBuckets = {
    overdue: [],
    finishing: [],
    dueSoon: [],
    active: [],
    allActive,
  };

  for (const project of allActive) {
    buckets[bucketForProject(project)].push(project);
  }

  return buckets;
}

export const BUCKET_LABELS: Record<CollaboratorProjectBucket, string> = {
  overdue: 'Atrasados',
  finishing: 'Por concluir',
  dueSoon: 'Próximos a vencer',
  active: 'Activos',
};

export const BUCKET_ORDER: CollaboratorProjectBucket[] = [
  'overdue',
  'dueSoon',
  'finishing',
  'active',
];
