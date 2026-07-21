import { MANAGER_OBSERVATIONS_KEY } from '../constants';
import type { ManagerEmployeeObservation, ManagerObservationsStore } from '../types';

export const EMPTY_MANAGER_OBSERVATIONS: ManagerObservationsStore = { items: [] };

export function loadManagerObservations(): ManagerObservationsStore {
  try {
    const raw = localStorage.getItem(MANAGER_OBSERVATIONS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as ManagerObservationsStore;
      if (Array.isArray(parsed.items)) return parsed;
    }
  } catch {
    /* ignore */
  }
  return EMPTY_MANAGER_OBSERVATIONS;
}

export function saveManagerObservations(store: ManagerObservationsStore): void {
  localStorage.setItem(MANAGER_OBSERVATIONS_KEY, JSON.stringify(store));
}

export function getManagerObservation(
  store: ManagerObservationsStore,
  employeeId: string,
  monthKey: string,
): ManagerEmployeeObservation | undefined {
  return store.items.find(
    (item) => item.employeeId === employeeId && item.monthKey === monthKey,
  );
}

export function upsertManagerObservation(
  store: ManagerObservationsStore,
  input: {
    employeeId: string;
    monthKey: string;
    text: string;
    authorId: string;
    authorName: string;
  },
): ManagerObservationsStore {
  const trimmed = input.text.trim();
  const existing = getManagerObservation(store, input.employeeId, input.monthKey);

  if (!trimmed) {
    if (!existing) return store;
    return { items: store.items.filter((item) => item.id !== existing.id) };
  }

  const updatedAt = new Date().toISOString();
  if (existing) {
    return {
      items: store.items.map((item) =>
        item.id === existing.id
          ? { ...item, text: trimmed, updatedAt, authorId: input.authorId, authorName: input.authorName }
          : item,
      ),
    };
  }

  const next: ManagerEmployeeObservation = {
    id: `mob-${Date.now()}-${input.employeeId}`,
    employeeId: input.employeeId,
    monthKey: input.monthKey,
    text: trimmed,
    updatedAt,
    authorId: input.authorId,
    authorName: input.authorName,
  };

  return { items: [...store.items, next] };
}
