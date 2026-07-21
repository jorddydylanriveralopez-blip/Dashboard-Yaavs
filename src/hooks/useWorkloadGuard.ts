import { useCallback, useState } from 'react';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import type {
  AssignmentBrief,
  CreativeProject,
  FileAttachment,
  WorkloadActionResult,
  WorkloadCheckResult,
} from '../types';

export interface AssignmentCreateInput {
  employeeId?: string;
  employeeIds?: string[];
  title: string;
  objective: string;
  dueDate: string;
  priority: 'baja' | 'media' | 'alta';
  notes: string;
  attachmentUrl?: string;
  attachments?: FileAttachment[];
  brief?: AssignmentBrief;
}

interface OverrideState {
  check: WorkloadCheckResult;
  retry: (password: string) => WorkloadActionResult;
  onSuccess: () => void;
}

export function useWorkloadGuard() {
  const { createAssignment, updateProject } = useApp();
  const toast = useToast();
  const [override, setOverride] = useState<OverrideState | null>(null);

  const handleResult = useCallback(
    (
      result: WorkloadActionResult,
      retry: (password: string) => WorkloadActionResult,
      onSuccess: () => void,
    ) => {
      if (result.ok) {
        onSuccess();
        return true;
      }
      if (result.reason === 'workload_limit') {
        setOverride({ check: result.status, retry, onSuccess });
        return false;
      }
      if (result.reason === 'invalid_override') {
        toast.error('Contraseña incorrecta. No se autorizó el trabajo extra.');
        return false;
      }
      return false;
    },
    [toast],
  );

  const submitAssignment = useCallback(
    (input: AssignmentCreateInput, onSuccess: () => void) => {
      const ids =
        input.employeeIds?.length
          ? input.employeeIds
          : input.employeeId
            ? [input.employeeId]
            : [];
      if (!ids.length) return false;

      const sendOne = (employeeId: string, overridePassword?: string) =>
        createAssignment(
          {
            employeeId,
            title: input.title,
            objective: input.objective,
            dueDate: input.dueDate,
            priority: input.priority,
            notes: input.notes,
            attachmentUrl: input.attachmentUrl,
            attachments: input.attachments,
            brief: input.brief,
          },
          overridePassword ? { overridePassword } : undefined,
        );

      const sendAll = (overridePassword?: string): WorkloadActionResult => {
        for (const employeeId of ids) {
          const result = sendOne(employeeId, overridePassword);
          if (!result.ok) return result;
        }
        return { ok: true };
      };

      const retry = (password: string) => sendAll(password);
      return handleResult(sendAll(), retry, onSuccess);
    },
    [createAssignment, handleResult],
  );

  const assignProjectCollaborators = useCallback(
    (
      projectId: string,
      collaborators: CreativeProject['collaborators'],
      onSuccess: () => void,
    ) => {
      const patch = { collaborators: collaborators ?? [] };
      const retry = (password: string) =>
        updateProject(projectId, patch, { overridePassword: password });
      return handleResult(updateProject(projectId, patch), retry, onSuccess);
    },
    [updateProject, handleResult],
  );

  const confirmOverride = useCallback(
    (password: string) => {
      if (!override) return;
      const result = override.retry(password);
      if (result.ok) {
        override.onSuccess();
        setOverride(null);
        toast.success('Trabajo extra autorizado y enviado.');
        return;
      }
      if (result.reason === 'invalid_override') {
        toast.error('Contraseña incorrecta.');
      }
    },
    [override, toast],
  );

  return {
    override,
    cancelOverride: () => setOverride(null),
    confirmOverride,
    submitAssignment,
    assignProjectCollaborators,
  };
}
