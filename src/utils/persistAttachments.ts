import type { FileAttachment } from '../types';
import { saveAssignmentAttachments, saveProjectAttachments } from './attachmentStore';

type UpdateProject = (
  id: string,
  patch: { attachmentCount: number },
) => void;

export async function persistProjectAttachments(
  projectId: string,
  attachments: FileAttachment[],
  updateProject: UpdateProject,
): Promise<void> {
  await saveProjectAttachments(projectId, attachments);
  updateProject(projectId, { attachmentCount: attachments.length });
}

export async function persistAssignmentAttachments(
  assignmentId: string,
  attachments: FileAttachment[],
): Promise<void> {
  if (attachments.length === 0) return;
  await saveAssignmentAttachments(assignmentId, attachments);
}
