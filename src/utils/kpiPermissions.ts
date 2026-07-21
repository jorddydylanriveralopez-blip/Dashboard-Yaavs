import type { User } from '../types';

const KPI_SENDER_USERNAMES = new Set(['orlando', 'admin', 'juancarlos']);

/** Puede asignar objetivos KPI mensuales al equipo (sin ser gerente completo). */
export function canSendKpiObjectives(user: User | null | undefined): boolean {
  if (!user) return false;
  if (user.role === 'admin' || user.role === 'lider') return true;
  return KPI_SENDER_USERNAMES.has(user.username.toLowerCase());
}

/** Puede configurar límites de carga de trabajo por colaborador. */
export function canManageWorkloadLimits(user: User | null | undefined): boolean {
  return canSendKpiObjectives(user);
}

/** Puede escribir observaciones personalizadas por colaborador. */
export function canWriteManagerObservations(user: User | null | undefined): boolean {
  return canSendKpiObjectives(user);
}
