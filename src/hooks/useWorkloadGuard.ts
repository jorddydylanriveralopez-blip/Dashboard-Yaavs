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
  employeeId: string;
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
      const retry = (password: string) => createAssignment(input, { overridePassword: password });
      return handleResult(createAssignment(input), retry, onSuccess);
    },
    [createAssignment, handleResult],
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

  const assignProjectCollaborator = useCallback(
    (
      projectId: string,
      collaborator: CreativeProject['collaborator'],
      onSuccess: () => void,
    ) => {
      const patch = { collaborator };
      const retry = (password: string) =>
        updateProject(projectId, patch, { overridePassword: password });
      return handleResult(updateProject(projectId, patch), retry, onSuccess);
    },
    [updateProject, handleResult],
  );

  return {
    override,
    cancelOverride: () => setOverride(null),
    confirmOverride,
    submitAssignment,
    assignProjectCollaborator,
  };
}
