import { COLLABORATORS, labelFor } from '../data/projectOptions';
import type { Collaborator, CreativeProject } from '../types';

export const INDIVIDUAL_COLLABORATORS = COLLABORATORS.filter((c) => c.value !== 'todos');

export function getProjectCollaborators(
  project: Pick<CreativeProject, 'collaborator' | 'collaborators'>,
): Collaborator[] {
  if (project.collaborators?.length) {
    const cleaned = project.collaborators.filter((c): c is Collaborator => Boolean(c));
    if (cleaned.includes('todos')) return ['todos'];
    if (cleaned.length) return cleaned;
  }
  if (project.collaborator === 'todos') return ['todos'];
  return project.collaborator ? [project.collaborator] : [];
}

export function normalizeProjectCollaborators(selected: Collaborator[]): Collaborator[] {
  const cleaned = selected.filter((c): c is Collaborator => Boolean(c) && c !== 'todos');
  if (selected.includes('todos')) return ['todos'];
  return [...new Set(cleaned)];
}

export function labelForProjectCollaborators(
  project: Pick<CreativeProject, 'collaborator' | 'collaborators'>,
): string {
  const collabs = getProjectCollaborators(project);
  if (collabs.includes('todos')) return 'TODOS';
  if (collabs.length === 0) return '—';
  return collabs
    .map((c) => labelFor(COLLABORATORS, c))
    .filter((label) => Boolean(label) && label !== '—')
    .join(', ');
}

export function patchForCollaboratorsChange(
  collaborators: Collaborator[],
): Pick<CreativeProject, 'collaborator' | 'collaborators' | 'assignedEmployeeId'> {
  const normalized = normalizeProjectCollaborators(collaborators);
  if (normalized.includes('todos')) {
    return { collaborators: ['todos'], collaborator: 'todos', assignedEmployeeId: undefined };
  }
  if (normalized.length === 1) {
    return {
      collaborators: normalized,
      collaborator: normalized[0],
      assignedEmployeeId: undefined,
    };
  }
  return {
    collaborators: normalized,
    collaborator: normalized[0],
    assignedEmployeeId: undefined,
  };
}

export function sanitizeProjectCollaborators(
  project: Pick<CreativeProject, 'collaborator' | 'collaborators'>,
): Pick<CreativeProject, 'collaborator' | 'collaborators'> {
  const collaborators = getProjectCollaborators(project);
  if (!collaborators.length) {
    return { collaborator: 'todos', collaborators: ['todos'] };
  }
  return {
    collaborators,
    collaborator: collaborators[0],
  };
}

export function projectIncludesCollaborator(
  project: Pick<CreativeProject, 'collaborator' | 'collaborators' | 'assignedEmployeeId'>,
  slug: Collaborator,
): boolean {
  const collabs = getProjectCollaborators(project);
  if (collabs.includes('todos')) return slug !== 'todos';
  return collabs.includes(slug);
}
